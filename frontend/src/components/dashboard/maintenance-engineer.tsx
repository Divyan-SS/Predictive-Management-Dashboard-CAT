import { API_URL, WS_URL } from "@/config/env";
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { UnifiedSubsystemMonitor } from "@/components/dashboard/unified-subsystem-monitor";

interface Task {
  id: string;
  asset: string;
  serial: string;
  taskName: string;
  priority: "CRITICAL" | "WARNING" | "ROUTINE";
  notes: string;
  status: "scheduled" | "in-progress" | "completed" | "closed";
  images: string[];
}

export const MaintenanceEngineerDashboard: React.FC = () => {
  const { user, accessToken } = useAuth();
  const engineerName = user?.name || user?.username || "Maintenance Engineer";
  const engineerEmail = user?.email;
  const siteName = user?.assigned_site || "";

  const [dbTasks, setDbTasks] = useState<any[]>([]);
  const [dbMachines, setDbMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTaskId, setActiveTaskId] = useState<string>("");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const fetchData = async () => {
    if (!accessToken) return;
    try {
      const headers = { "Authorization": `Bearer ${accessToken}` };
      const tRes = await fetch(`${API_URL}/api/maintenance/work-orders/`, { headers });
      const mRes = await fetch(`${API_URL}/api/machinery/machines/`, { headers });
      
      let tList = [];
      if (tRes.ok) tList = await tRes.json();
      tList = Array.isArray(tList) ? tList : tList.results || [];

      let mList = [];
      if (mRes.ok) mList = await mRes.json();
      mList = Array.isArray(mList) ? mList : mList.results || [];

      setDbTasks(tList);
      setDbMachines(mList);
    } catch (err) {
      console.error("Maintenance Engineer fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [accessToken]);

  // Map database tasks into format
  const engineerTasks = useMemo(() => {
    const filtered = dbTasks.filter(t => t.serviceEngineer === engineerEmail || t.site === siteName);
    return filtered.map((t: any) => ({
      id: String(t.id),
      asset: t.machineCode || t.machine_name || "CAT Asset",
      serial: t.serial_number || "CAT-320-PE03",
      taskName: t.problem || "Subsystem Overhaul",
      priority: (t.priority || "routine").toUpperCase() as any,
      notes: t.instructions?.join(". ") || t.problem || "Standard repairs required.",
      status: t.status === "Completed" ? "completed" : t.status === "Rework" ? "in-progress" : "scheduled",
      images: t.images || []
    }));
  }, [dbTasks, engineerEmail, siteName]);

  useEffect(() => {
    if (engineerTasks.length > 0 && !activeTaskId) {
      setActiveTaskId(engineerTasks[0].id);
    }
  }, [engineerTasks, activeTaskId]);

  const activeTask = useMemo(() => {
    return engineerTasks.find((t) => t.id === activeTaskId) || engineerTasks[0] || null;
  }, [engineerTasks, activeTaskId]);

  const activeMachine = useMemo(() => {
    if (!activeTask) return null;
    return dbMachines.find(m => m.serial_number === activeTask.serial || m.name === activeTask.asset);
  }, [dbMachines, activeTask]);

  const completedTasks = useMemo(() => {
    const filtered = dbTasks.filter(t => (t.serviceEngineer === engineerEmail || t.site === siteName) && t.status === "Completed");
    return filtered.map(t => ({
      id: String(t.id),
      asset: t.machineCode || t.machine_name || "CAT Asset",
      taskName: t.problem || "Calibration Check",
      date: "Completed",
      status: "completed"
    }));
  }, [dbTasks, engineerEmail, siteName]);

  const assignedMachines = useMemo(() => {
    const siteMachines = siteName 
      ? dbMachines.filter(m => m.site_name === siteName || (m.site_name && m.site_name.toLowerCase().includes(siteName.toLowerCase())))
      : dbMachines;
    return siteMachines.map(m => {
      const health = m.status === "operational" ? "95%" : m.status === "warning" ? "75%" : "45%";
      return {
        id: m.id,
        name: m.name,
        serial: m.serial_number,
        model: m.model,
        health,
        status: m.status === "operational" ? "nominal" as const : "warning" as const
      };
    });
  }, [dbMachines, siteName]);

  // Image Upload Simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev === null) return null;
        if (prev >= 100) {
          clearInterval(interval);
          setUploadedFiles((prevFiles) => [...prevFiles, file.name]);
          setUploadProgress(null);
          return null;
        }
        return prev + 25;
      });
    }, 150);
  };

  // Complete / Close Task logic
  const handleTaskStateTransition = async (newStatus: "completed" | "closed") => {
    if (!activeTask) return;
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/maintenance/work-orders/${activeTask.id}/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus === "completed" ? "completed" : "closed",
          engineer_notes: inspectionNotes || undefined,
          images: uploadedFiles.length > 0 ? uploadedFiles : undefined
        })
      });

      if (res.ok) {
        await fetchData();
        setInspectionNotes("");
        setUploadedFiles([]);
      }
    } catch (err) {
      console.error("Failed to update work order status:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 h-[300px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCD00] mx-auto"></div>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Loading Fleet Roster...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Info */}
      <Card className="p-4 bg-[#FFFBEB]/50 dark:bg-stone-950/20 border-stone-200 dark:border-stone-800 flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#FFCD00]">Maintenance Engineering Console</span>
          <h3 className="text-lg font-bold text-stone-900 dark:text-stone-50">Active Work Orders: {engineerName}</h3>
        </div>
        <div className="flex gap-4 text-xs">
          <div>
            <span className="text-stone-500 font-semibold block">Supervised Assets:</span>
            <span className="font-bold">{assignedMachines.length} Machines</span>
          </div>
          <div>
            <span className="text-stone-500 font-semibold block">Scheduled Hours:</span>
            <span className="font-bold">08:00 - 16:00 {siteName || "Global"} Shift</span>
          </div>
        </div>
      </Card>

      {/* Live Telemetry Operational Dashboard */}
      <Card className="p-5 border-stone-200 dark:border-stone-800">
        <span className="text-[10px] uppercase font-bold text-stone-500 block mb-3">Live Fleet Operational Subsystem Telemetry</span>
        <UnifiedSubsystemMonitor machineId={activeMachine ? activeMachine.id : (dbMachines.length > 0 ? dbMachines[0].id : "")} />
      </Card>

      {/* Main Grid split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Task list and active update interface */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Work Order Action Box */}
          {activeTask && (
            <Card className="p-5 border border-stone-200 dark:border-stone-800">
              <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800 flex-wrap gap-2">
                <div>
                  <span className="text-[10px] font-mono text-stone-400 font-bold block">WO-{activeTask.id} ({activeTask.serial})</span>
                  <h3 className="text-sm font-extrabold uppercase tracking-wide mt-0.5">{activeTask.taskName}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={activeTask.priority === "CRITICAL" ? "danger" : activeTask.priority === "WARNING" ? "warning" : "neutral"}>
                    {activeTask.priority}
                  </Badge>
                  <Badge variant="warning" className="uppercase font-mono text-[9px]">{activeTask.status}</Badge>
                </div>
              </div>

              {/* Task Details */}
              <div className="py-4 space-y-4 text-xs">
                <div>
                  <span className="text-stone-500 font-bold block mb-1">Standard Work Instructions:</span>
                  <p className="p-3 bg-stone-50 dark:bg-stone-950/70 border border-stone-300 dark:border-stone-800 text-stone-600 dark:text-stone-400 leading-5 rounded">
                    {activeTask.notes}
                  </p>
                </div>

                {/* File Upload/Input for closing or updating task status */}
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Diagnostic Details & Notes</label>
                    <textarea
                      value={inspectionNotes}
                      onChange={(e) => setInspectionNotes(e.target.value)}
                      placeholder="Input detailed diagnostic adjustments made, torque limits checked, and vibration metrics verified..."
                      className="w-full h-24 p-3 bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-800 rounded focus:outline-none focus:border-[#FFCD00]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold text-stone-500 block mb-1">Upload Work Photos</label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="file"
                        onChange={handleFileUpload}
                        className="max-w-[250px] h-9 text-xs"
                      />
                      {uploadProgress !== null && (
                        <span className="text-[10px] font-mono text-stone-400 font-bold">{uploadProgress}% Uploading...</span>
                      )}
                    </div>
                    {uploadedFiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {uploadedFiles.map((file) => (
                          <Badge key={file} variant="neutral" className="normal-case">
                            📎 {file}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 border-t border-stone-200 dark:border-stone-800 pt-4">
                <Button
                  onClick={() => handleTaskStateTransition("completed")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider text-xs px-4 h-9 cursor-pointer"
                >
                  Mark Completed
                </Button>
                <Button
                  onClick={() => handleTaskStateTransition("closed")}
                  className="bg-stone-800 hover:bg-stone-900 text-stone-200 border border-stone-700 font-bold uppercase tracking-wider text-xs px-4 h-9 cursor-pointer"
                >
                  Close Work Order
                </Button>
              </div>
            </Card>
          )}

        </div>

        {/* Right 1 Column: Task list navigation, History, Supervised Machines status */}
        <div className="space-y-6">
          
          {/* Active queue list */}
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Work Order Queue</h3>
            <div className="space-y-2">
              {engineerTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTaskId(t.id)}
                  className={`w-full text-left p-3 rounded border text-xs transition-colors flex flex-col gap-1 cursor-pointer ${
                    activeTaskId === t.id
                      ? "bg-[#FFFBEB]/60 dark:bg-stone-900/50 border-[#FFCD00]"
                      : "bg-stone-50/50 dark:bg-stone-950/20 border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-850"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-stone-900 dark:text-stone-100">{t.asset}</span>
                    <Badge variant={t.priority === "CRITICAL" ? "danger" : t.priority === "WARNING" ? "warning" : "neutral"}>
                      {t.priority}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-stone-500 font-medium line-clamp-1">{t.taskName}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Supervised machinery checklist */}
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Site Hardware Registry</h3>
            <div className="space-y-3">
              {assignedMachines.map((m) => (
                <div key={m.serial} className="flex items-center justify-between text-xs p-2.5 rounded border border-stone-200 dark:border-stone-800 bg-stone-50/20 dark:bg-stone-950/10">
                  <div>
                    <span className="font-bold text-stone-900 dark:text-stone-100 block">{m.name}</span>
                    <span className="text-[10px] font-mono text-stone-400 block mt-0.5">{m.serial}</span>
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

          {/* History log */}
          <Card className="p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-3">Completed Operations</h3>
            {completedTasks.length === 0 ? (
              <p className="text-[10px] text-stone-500 text-center py-2">No completed orders in this shift.</p>
            ) : (
              <div className="space-y-2.5">
                {completedTasks.map((h, i) => (
                  <div key={i} className="flex items-center justify-between text-xs pb-2 border-b border-stone-150 dark:border-stone-800 last:border-b-0 last:pb-0">
                    <div>
                      <span className="font-bold text-stone-800 dark:text-stone-200 block">{h.asset}</span>
                      <span className="text-[10px] text-stone-500 block mt-0.5">{h.taskName}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] text-emerald-500 font-bold uppercase">{h.status}</span>
                      <span className="text-[9px] text-stone-400 block mt-0.5">{h.date}</span>
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
