import { API_URL, WS_URL } from "@/config/env";
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { UnifiedSubsystemMonitor } from "@/components/dashboard/unified-subsystem-monitor";

interface ServiceRequest {
  id: string;
  asset: string;
  serial: string;
  site: string;
  problem: string;
  status: "pending" | "in-progress" | "resolved";
  partsReplaced: string[];
  reportUploaded: string | null;
}

export const ServiceTeamDashboard: React.FC = () => {
  const { user, accessToken } = useAuth();
  const teamName = user?.name || user?.username || "Service Team";
  const siteName = user?.assigned_site || "";

  const [dbTasks, setDbTasks] = useState<any[]>([]);
  const [dbMachines, setDbMachines] = useState<any[]>([]);
  const [dbSites, setDbSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRequestId, setSelectedRequestId] = useState<string>("");
  const [newPartName, setNewPartName] = useState("");
  const [partsList, setPartsList] = useState<string[]>([]);
  const [reportFileName, setReportFileName] = useState<string | null>(null);
  const [reportUploading, setReportUploading] = useState<number | null>(null);

  const fetchData = async () => {
    if (!accessToken) return;
    try {
      const headers = { "Authorization": `Bearer ${accessToken}` };
      const tRes = await fetch(`${API_URL}/api/maintenance/work-orders/`, { headers });
      const mRes = await fetch(`${API_URL}/api/machinery/machines/`, { headers });
      const sRes = await fetch(`${API_URL}/api/machinery/sites/`, { headers });

      let tList = [];
      if (tRes.ok) tList = await tRes.json();
      tList = Array.isArray(tList) ? tList : tList.results || [];

      let mList = [];
      if (mRes.ok) mList = await mRes.json();
      mList = Array.isArray(mList) ? mList : mList.results || [];

      let sList = [];
      if (sRes.ok) sList = await sRes.json();
      sList = Array.isArray(sList) ? sList : sList.results || [];

      setDbTasks(tList);
      setDbMachines(mList);
      setDbSites(sList);
    } catch (err) {
      console.error("Service Team fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [accessToken]);

  // Map database tasks into format
  const requests = useMemo(() => {
    const filtered = dbTasks.filter(t => t.site === siteName);
    return filtered.map((t: any) => ({
      id: String(t.id),
      asset: t.machineCode || t.machine_name || "CAT Asset",
      serial: t.serial_number || "CAT-320-PE03",
      site: t.site || siteName,
      problem: t.problem || "Requires diagnostics swap.",
      status: t.status === "Completed" ? "resolved" as const : t.status === "Rework" ? "in-progress" as const : "pending" as const,
      partsReplaced: t.parts_replaced || [],
      reportUploaded: t.images?.[0] || null
    }));
  }, [dbTasks, siteName]);

  useEffect(() => {
    if (requests.length > 0 && !selectedRequestId) {
      setSelectedRequestId(requests[0].id);
    }
  }, [requests, selectedRequestId]);

  const activeRequest = useMemo(() => {
    return requests.find((r) => r.id === selectedRequestId) || requests[0] || null;
  }, [requests, selectedRequestId]);

  const activeMachine = useMemo(() => {
    if (!activeRequest) return null;
    return dbMachines.find(m => m.serial_number === activeRequest.serial || m.name === activeRequest.asset);
  }, [dbMachines, activeRequest]);

  const history = useMemo(() => {
    const filtered = dbTasks.filter(t => t.site === siteName && t.status === "Completed");
    return filtered.map(t => ({
      id: String(t.id),
      asset: t.machineCode || t.machine_name || "CAT Asset",
      site: t.site || siteName,
      taskName: t.problem?.split(".")[0] || "Alternator Calibration",
      date: "Completed",
      parts: t.parts_replaced && t.parts_replaced.length > 0 ? t.parts_replaced : ["Maintenance check performed"]
    }));
  }, [dbTasks, siteName]);

  const assignedSites = useMemo(() => {
    const siteObj = dbSites.find(s => s.name === siteName);
    const machinesCount = dbMachines.filter(m => m.site_name === siteName).length;
    return [{
      name: siteName || "Primary Facility",
      location: siteObj?.location || "India",
      machinesCount,
      status: "Active Support"
    }];
  }, [dbSites, dbMachines, siteName]);

  const coveredMachines = useMemo(() => {
    const siteMachines = dbMachines.filter(m => m.site_name === siteName);
    return siteMachines.map(m => {
      const health = m.status === "operational" ? "95%" : m.status === "warning" ? "75%" : "45%";
      return {
        name: m.name,
        site: siteName,
        health,
        status: m.status === "operational" ? "nominal" : "warning"
      };
    });
  }, [dbMachines, siteName]);

  const handleAddPart = () => {
    if (!newPartName.trim()) return;
    setPartsList([...partsList, newPartName.trim()]);
    setNewPartName("");
  };

  const handleReportUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setReportUploading(0);
    const interval = setInterval(() => {
      setReportUploading((prev) => {
        if (prev === null) return null;
        if (prev >= 100) {
          clearInterval(interval);
          setReportFileName(file.name);
          setReportUploading(null);
          return null;
        }
        return prev + 20;
      });
    }, 120);
  };

  const handleStartWork = async () => {
    if (!activeRequest) return;
    try {
      const token = localStorage.getItem("access_token");
      await fetch(`${API_URL}/api/maintenance/work-orders/${activeRequest.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          status: "IN_PROGRESS"
        })
      });
      await fetchData();
    } catch (err) {
      console.error("Failed to start work:", err);
    }
  };

  const handleMarkRepaired = async () => {
    if (!activeRequest) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/maintenance/work-orders/${activeRequest.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          status: "SERVICE_COMPLETED",
          inspection_status: "PENDING",
          parts_replaced: partsList,
          images: reportFileName ? [reportFileName] : undefined
        })
      });

      if (res.ok) {
        await fetchData();
        setPartsList([]);
        setReportFileName(null);
      }
    } catch (err) {
      console.error("Failed to resolve service request:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 h-[300px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCD00] mx-auto"></div>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Loading Service Queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Team Header */}
      <Card className="p-4 bg-[#FFFBEB]/50 dark:bg-stone-950/20 border-stone-200 dark:border-stone-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#FFCD00]">Service Operations Console</span>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Active Team: {teamName}</h3>
        </div>
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-stone-500 font-semibold block">Covered Facilities:</span>
            <span className="font-bold">{assignedSites.length} Site(s)</span>
          </div>
          <div>
            <span className="text-stone-500 font-semibold block">Assigned Site:</span>
            <span className="font-bold">{siteName || "Global Operations"}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Selected Request details and resolution forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {activeRequest && (
            <Card className="p-5 border border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 flex-wrap gap-2">
                <div>
                  <span className="text-[10px] font-mono text-stone-400 font-bold block">SR-{activeRequest.id} ({activeRequest.serial})</span>
                  <h3 className="text-sm font-extrabold uppercase tracking-wide mt-0.5">{activeRequest.asset}</h3>
                  <span className="text-[10px] text-stone-400 block mt-0.5">Location: {activeRequest.site}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={activeRequest.status === "resolved" ? "success" : activeRequest.status === "in-progress" ? "warning" : "neutral"}>
                    {activeRequest.status}
                  </Badge>
                </div>
              </div>

              {/* Request description */}
              <div className="py-4 space-y-4 text-xs">
                <div>
                  <span className="text-stone-500 font-bold block mb-1">Issue Reported:</span>
                  <p className="p-3 bg-stone-50 dark:bg-stone-950/70 border border-stone-300 dark:border-stone-800 text-stone-600 dark:text-stone-400 leading-5 rounded">
                    {activeRequest.problem}
                  </p>
                </div>

                {activeMachine && (
                  <div className="pt-4 mt-4 border-t border-stone-200 dark:border-stone-800">
                    <span className="text-[10px] uppercase font-bold text-stone-500 block mb-3">Live Subsystem Telemetry Diagnostics</span>
                    <UnifiedSubsystemMonitor machineId={activeMachine.id} />
                  </div>
                )}

                {activeRequest.status !== "resolved" && (
                  <div className="space-y-4 border-t border-stone-200 dark:border-stone-800 pt-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">Resolve Request Checklist</h4>
                    
                    {/* Parts Replaced Tracker */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-stone-500 block">Parts Replaced / Installed</label>
                      <div className="flex gap-2 max-w-md">
                        <Input
                          value={newPartName}
                          onChange={(e) => setNewPartName(e.target.value)}
                          placeholder="e.g. Hydraulic pressure sensor pin"
                          className="h-8 text-xs"
                        />
                        <Button
                          onClick={handleAddPart}
                          className="h-8 px-3 font-bold uppercase text-[10px] cursor-pointer"
                        >
                          Add Part
                        </Button>
                      </div>
                      {partsList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {partsList.map((part) => (
                            <Badge key={part} variant="neutral" className="normal-case">
                              ⚙️ {part}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Report File upload */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold text-stone-500 block">Service Report / Diagnostic Logs</label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          onChange={handleReportUpload}
                          className="max-w-[250px] h-8 text-xs"
                        />
                        {reportUploading !== null && (
                          <span className="text-[10px] font-mono text-stone-400">{reportUploading}% Uploading...</span>
                        )}
                      </div>
                      {reportFileName && (
                        <p className="text-[10px] text-emerald-500 font-bold mt-1">✅ Report attached: {reportFileName}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {activeRequest.status !== "resolved" && (
                <div className="flex justify-end gap-3 border-t border-stone-200 dark:border-stone-800 pt-4">
                  {(activeRequest.status as string) === "pending" || (activeRequest.status as string) === "NOT_STARTED" ? (
                    <Button
                      onClick={handleStartWork}
                      variant="primary"
                      className="bg-amber-500 hover:bg-amber-600 text-black font-extrabold uppercase tracking-wider text-xs px-4 h-9 cursor-pointer"
                    >
                      ▶ Start Work
                    </Button>
                  ) : (activeRequest.status as string) === "in-progress" || (activeRequest.status as string) === "IN_PROGRESS" ? (
                    <Button
                      onClick={handleMarkRepaired}
                      className="bg-[#FFCD00] hover:bg-[#E6B800] text-black font-extrabold uppercase tracking-wider text-xs px-4 h-9 cursor-pointer"
                    >
                      ✓ Complete Repair & Submit for Inspection
                    </Button>
                  ) : (
                    <Badge variant="warning" className="text-xs px-3 py-1.5 font-extrabold uppercase tracking-wider">
                      ⏳ Awaiting Inspection Approval
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          )}

        </div>

        {/* Right Column: Request Queue, Assigned Sites list, covered assets list */}
        <div className="space-y-6">
          
          {/* Service Queue list */}
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Service Requests Queue</h3>
            <div className="space-y-2">
              {requests.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRequestId(r.id)}
                  className={`w-full text-left p-3 rounded border text-xs transition-colors flex flex-col gap-1 cursor-pointer ${
                    selectedRequestId === r.id
                      ? "bg-[#FFFBEB]/60 dark:bg-stone-900/50 border-[#FFCD00]"
                      : "bg-stone-50/50 dark:bg-stone-950/20 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-850"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-stone-900 dark:text-stone-100">{r.asset}</span>
                    <Badge variant={r.status === "resolved" ? "success" : r.status === "in-progress" ? "warning" : "neutral"}>
                      {r.status}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-stone-500 line-clamp-1 font-medium">{r.problem}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Covered site machines list */}
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Covered Site Hardware</h3>
            <div className="space-y-3">
              {coveredMachines.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs p-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50/20 dark:bg-stone-950/10">
                  <div>
                    <span className="font-bold text-stone-900 dark:text-stone-100 block">{m.name}</span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">{m.site}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={m.status === "nominal" ? "success" : "warning"}>
                      {m.status}
                    </Badge>
                    <span className="text-[9px] text-stone-500 block mt-1 font-extrabold">Health: {m.health}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Repair History log */}
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Service Log History</h3>
            {history.length === 0 ? (
              <p className="text-[10px] text-stone-500 text-center py-2">No repair history logged.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h, i) => (
                  <div key={i} className="text-xs pb-3 border-b border-stone-150 dark:border-stone-800 last:border-b-0 last:pb-0 last:mb-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-850 dark:text-stone-200">{h.asset}</span>
                      <span className="text-[9px] text-stone-400 font-mono">{h.date}</span>
                    </div>
                    <p className="text-[10px] text-stone-500 leading-4">{h.taskName}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {h.parts.map((p: string) => (
                        <Badge key={p} variant="neutral" className="px-1.5 py-0 text-[8px] tracking-wide normal-case bg-stone-100 dark:bg-stone-900">
                          ⚙️ {p}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </div>

      </div>

    </div>
  );
};
