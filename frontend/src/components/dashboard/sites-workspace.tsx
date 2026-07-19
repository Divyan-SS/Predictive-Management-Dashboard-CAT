import { API_URL, WS_URL } from "@/config/env";
import React, { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Interfaces
interface Site {
  id: string;
  name: string;
  supervisor: string;
  totalMachines: number;
  onlineMachines: number;
  offlineMachines: number;
  health: number;
  status: "nominal" | "warning" | "critical";
  activeAlerts: number;
  openMaintenance: number;
  lastUpdated: string;
  location: string;
}

interface Machine {
  id?: string;
  name: string;
  serial: string;
  status: "operational" | "warning" | "critical";
  health: number;
  temp: number;
  vibration: number;
}

interface Alert {
  asset: string;
  mode: string;
  time: string;
  severity: "critical" | "warning" | "info";
}

interface Task {
  time: string;
  asset: string;
  task: string;
  tech: string;
  status: "completed" | "scheduled";
}

interface SitesWorkspaceProps {
  onTriggerMessage?: (managerId: string, context: string, body: string) => void;
}

import { useAuth } from "@/context/AuthContext";
import { UnifiedSubsystemMonitor } from "@/components/dashboard/unified-subsystem-monitor";

export const SitesWorkspace: React.FC<SitesWorkspaceProps> = ({ onTriggerMessage }) => {
  const { user } = useAuth();
  const [dbSites, setDbSites] = useState<any[]>([]);
  const [dbMachines, setDbMachines] = useState<any[]>([]);
  const [dbAlerts, setDbAlerts] = useState<any[]>([]);
  const [dbTasks, setDbTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMachineId, setExpandedMachineId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      setLoading(true);
      try {
        const headers = { "Authorization": `Bearer ${token}` };
        const sRes = await fetch(`${API_URL}/api/machinery/sites/`, { headers });
        const mRes = await fetch(`${API_URL}/api/machinery/machines/`, { headers });
        const aRes = await fetch(`${API_URL}/api/telemetry/alerts/`, { headers });
        const tRes = await fetch(`${API_URL}/api/maintenance/work-orders/`, { headers });

        let sList = [];
        if (sRes.ok) sList = await sRes.json();
        sList = Array.isArray(sList) ? sList : sList.results || [];

        let mList = [];
        if (mRes.ok) mList = await mRes.json();
        mList = Array.isArray(mList) ? mList : mList.results || [];

        let aList = [];
        if (aRes.ok) aList = await aRes.json();
        aList = Array.isArray(aList) ? aList : aList.results || [];

        let tList = [];
        if (tRes.ok) tList = await tRes.json();
        tList = Array.isArray(tList) ? tList : tList.results || [];

        setDbSites(sList);
        setDbMachines(mList);
        setDbAlerts(aList);
        setDbTasks(tList);
      } catch (err) {
        console.error("Failed to fetch sites data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getEstimatedHealth = (status: string) => {
    if (status === "operational") return 95;
    if (status === "warning") return 75;
    if (status === "critical") return 45;
    return 90;
  };

  const getVibrationEstimate = (status: string) => {
    if (status === "operational") return 1.2;
    if (status === "warning") return 3.4;
    if (status === "critical") return 5.8;
    return 1.0;
  };

  const getManagerEmailForSite = (siteName: string): string => {
    const norm = siteName.toLowerCase();
    if (norm.includes("cas")) return "manager1@cat.com";
    if (norm.includes("tech")) return "manager2@cat.com";
    if (norm.includes("ngp")) return "manager3@cat.com";
    if (norm.includes("kmch")) return "manager4@cat.com";
    return "admin@cat.com";
  };

  const handleMessageClick = (machineCode: string, siteName: string, severity: string) => {
    if (onTriggerMessage) {
      const managerEmail = getManagerEmailForSite(siteName);
      onTriggerMessage(
        managerEmail,
        `Regarding ${machineCode.replace("CAT ", "CAT")} - ${severity.toUpperCase()} Alert`,
        `Can you provide an update on why this machine is still in a ${severity} state?`
      );
    }
  };

  // Compile sites list dynamically
  const sites: Site[] = useMemo(() => {
    let rawSites = dbSites;
    const assignedSite = user?.assigned_site || "";
    if (user?.role?.name !== "Super Admin" && assignedSite) {
      const filtered = dbSites.filter(s => s.name === assignedSite || (s.name && s.name.toLowerCase().includes(assignedSite.toLowerCase())));
      if (filtered.length > 0) rawSites = filtered;
    }

    return rawSites.map(s => {
      const siteMachines = dbMachines.filter(m => m.site === s.id || m.site_name === s.name);
      const siteMachineIds = new Set(siteMachines.map(m => m.id));

      const siteAlerts = dbAlerts.filter(a => siteMachineIds.has(a.machine));
      const siteTasks = dbTasks.filter(t => siteMachineIds.has(t.machine) || t.site === s.name);

      const totalHealth = siteMachines.reduce((sum, m) => sum + getEstimatedHealth(m.status), 0);
      const avgHealth = siteMachines.length > 0 ? Number((totalHealth / siteMachines.length).toFixed(1)) : 100;

      let status: "nominal" | "warning" | "critical" = "nominal";
      if (siteMachines.some(m => m.status === "critical")) {
        status = "critical";
      } else if (siteMachines.some(m => m.status === "warning")) {
        status = "warning";
      }

      return {
        id: s.id,
        name: s.name,
        supervisor: s.manager_name || "Unassigned Supervisor",
        totalMachines: siteMachines.length,
        onlineMachines: siteMachines.filter(m => m.status === "operational").length,
        offlineMachines: siteMachines.filter(m => m.status !== "operational").length,
        health: avgHealth,
        status,
        activeAlerts: siteAlerts.length,
        openMaintenance: siteTasks.filter(t => t.status !== "Completed").length,
        lastUpdated: "Just now",
        location: s.location || "India"
      };
    });
  }, [dbSites, dbMachines, dbAlerts, dbTasks, user]);

  // State Management
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      if (user?.role?.name !== "Super Admin") {
        setSelectedSiteId(sites[0].id);
      }
    }
  }, [sites, selectedSiteId, user]);

  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("health-desc");

  // Selected site data resolver (returns null if no site is selected, displaying 4 site cards overview)
  const selectedSite = useMemo(() => {
    if (!selectedSiteId) return null;
    return sites.find(s => s.id === selectedSiteId) || null;
  }, [selectedSiteId, sites]);

  const selectedSiteMachines = useMemo(() => {
    if (!selectedSite) return [];
    const siteMachines = dbMachines.filter(m => m.site === selectedSite.id || m.site_name === selectedSite.name);
    return siteMachines.map(m => ({
      id: m.id,
      name: m.name,
      serial: m.serial_number,
      status: m.status as any,
      health: getEstimatedHealth(m.status),
      temp: m.status === "critical" ? 95 : m.status === "warning" ? 78 : 65,
      vibration: getVibrationEstimate(m.status)
    }));
  }, [selectedSite, dbMachines]);

  const selectedSiteAlerts: Alert[] = useMemo(() => {
    if (!selectedSite) return [];
    const siteMachines = dbMachines.filter(m => m.site === selectedSite.id || m.site_name === selectedSite.name);
    const siteMachineIds = new Set(siteMachines.map(m => m.id));
    const siteAlerts = dbAlerts.filter(a => siteMachineIds.has(a.machine));
    return siteAlerts.map(a => ({
      asset: a.machine_name || "Asset",
      mode: a.message || "Alert",
      time: "Active",
      severity: a.severity as any
    }));
  }, [selectedSite, dbMachines, dbAlerts]);

  const selectedSiteTasks: Task[] = useMemo(() => {
    if (!selectedSite) return [];
    const siteMachines = dbMachines.filter(m => m.site === selectedSite.id || m.site_name === selectedSite.name);
    const siteMachineIds = new Set(siteMachines.map(m => m.id));
    const siteTasks = dbTasks.filter(t => siteMachineIds.has(t.machine) || t.site === selectedSite.name);
    return siteTasks.map(t => ({
      time: t.assignedTime || "08:00",
      asset: t.machineCode || "Machine",
      task: t.problem || "Inspection",
      tech: t.serviceEngineer || "Unassigned",
      status: t.status === "Completed" ? "completed" : "scheduled"
    }));
  }, [selectedSite, dbMachines, dbTasks]);

  // Filters calculation for Level 1 overview
  const filteredSites = useMemo(() => {
    let result = [...sites];

    // Search filter
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.supervisor.toLowerCase().includes(q));
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(s => s.status === statusFilter);
    }

    // Health filter
    if (healthFilter !== "all") {
      if (healthFilter === "high") {
        result = result.filter(s => s.health >= 90);
      } else if (healthFilter === "medium") {
        result = result.filter(s => s.health >= 80 && s.health < 90);
      } else if (healthFilter === "low") {
        result = result.filter(s => s.health < 80);
      }
    }

    // Sort By
    if (sortBy === "health-desc") {
      result.sort((a, b) => b.health - a.health);
    } else if (sortBy === "health-asc") {
      result.sort((a, b) => a.health - b.health);
    } else if (sortBy === "machines-desc") {
      result.sort((a, b) => b.totalMachines - a.totalMachines);
    } else if (sortBy === "name-asc") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [sites, searchQuery, statusFilter, healthFilter, sortBy]);

  const getHealthBadgeColor = (health: number) => {
    if (health >= 90) return "success";
    if (health >= 80) return "warning";
    return "danger";
  };

  const getStatusBadgeVariant = (status: "nominal" | "warning" | "critical") => {
    if (status === "nominal") return "success";
    if (status === "warning") return "warning";
    return "danger";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 h-[300px]">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCD00] mx-auto"></div>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Loading Platform Sites...</p>
        </div>
      </div>
    );
  }

  // If a site is selected, render LEVEL 2 (Site detailed dashboard view)
  if (selectedSite) {
    const machines = selectedSiteMachines;
    const alerts = selectedSiteAlerts;
    const tasks = selectedSiteTasks;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Back navigation strip */}
        <div className="flex items-center justify-between">
          {user?.role?.name === "Super Admin" ? (
            <button
              onClick={() => setSelectedSiteId(null)}
              className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-250 transition-colors uppercase font-bold tracking-wider"
            >
              ← Back to Global Sites Overview
            </button>
          ) : (
            <span className="text-xs text-stone-400 font-bold uppercase tracking-wider">Assigned Site Workspace</span>
          )}
          <Badge variant={getStatusBadgeVariant(selectedSite.status)}>
            Site Status: {selectedSite.status}
          </Badge>
        </div>

        {/* Detailed Site Header */}
        <Card className="p-5 border-stone-200 dark:border-stone-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#FFCD00]">Facility Dashboard</span>
              <h3 className="text-xl font-bold text-stone-900 dark:text-stone-50">{selectedSite.name}</h3>
              <p className="text-xs text-stone-500 mt-1">{selectedSite.location}</p>
            </div>
            <div className="flex flex-wrap gap-6 text-xs border-l border-stone-200 dark:border-stone-800 pl-6">
              <div>
                <span className="text-stone-500 font-semibold block uppercase text-[10px]">Supervisor</span>
                <span className="font-extrabold text-stone-800 dark:text-stone-200">{selectedSite.supervisor}</span>
              </div>
              <div>
                <span className="text-stone-500 font-semibold block uppercase text-[10px]">Average Health</span>
                <span className={`font-extrabold ${
                  selectedSite.health >= 90 ? "text-emerald-500" : selectedSite.health >= 80 ? "text-amber-500" : "text-red-500"
                }`}>{selectedSite.health}%</span>
              </div>
              <div>
                <span className="text-stone-500 font-semibold block uppercase text-[10px]">Last Updated</span>
                <span className="font-mono text-stone-500">{selectedSite.lastUpdated}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Detailed Grid content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Machinery Assets & Live Equipment Telemetry</CardTitle>
                  <CardDescription>Real-time equipment hardware status, live sensor readings, and anomaly diagnostics</CardDescription>
                </div>
                <Badge variant="neutral">Count: {machines.length}</Badge>
              </CardHeader>
              <div className="space-y-6 p-4">
                {machines.length === 0 ? (
                  <p className="text-xs text-stone-500 p-6 text-center">No active machines linked to this site.</p>
                ) : (
                  <div className="space-y-6">
                    {machines.map((m) => (
                      <Card key={m.serial} className="p-4 border-stone-200 dark:border-stone-800 space-y-4">
                        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3 flex-wrap gap-2">
                          <div>
                            <span className="text-[10px] font-mono text-stone-400 font-bold block">{m.serial}</span>
                            <h4 className="text-sm font-extrabold text-stone-900 dark:text-stone-50">{m.name}</h4>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-stone-500">Health Index: <strong className={m.health > 85 ? "text-emerald-500" : "text-amber-500"}>{m.health}%</strong></span>
                            {(m.status === "warning" || m.status === "critical") && (
                              <button
                                type="button"
                                onClick={() => handleMessageClick(m.name, selectedSite.name, m.status)}
                                title="Message Manager"
                                className="text-stone-500 hover:text-[#FFCD00] transition-colors cursor-pointer text-xs"
                              >
                                💬 Message
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Always-visible Live Subsystem Telemetry Monitor */}
                        <div className="pt-2">
                          <span className="text-[10px] uppercase font-bold text-[#FFCD00] tracking-widest block mb-2">Live Equipment Subsystem Telemetry Readings</span>
                          <UnifiedSubsystemMonitor machineId={m.id || m.serial} />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4">Active Site Alarms</h3>
              {alerts.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">No active alarms for this site.</p>
              ) : (
                <div className="space-y-3">
                  {alerts.map((a, i) => (
                    <div key={i} className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-50 block">{a.asset}</span>
                        <span className="text-[10px] text-amber-500 font-bold uppercase block mt-0.5">{a.mode}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={a.severity === "critical" ? "warning" : "neutral"}>
                          {a.severity}
                        </Badge>
                        <span className="text-[9px] text-stone-500 block mt-1 font-mono">{a.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4">Site Action Plan</h3>
              {tasks.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">No active maintenance tasks planned.</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((t, i) => (
                    <div key={i} className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-[#FFCD00] font-mono">{t.time}</span>
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-50">{t.asset}</span>
                        </div>
                        <span className="text-[10px] text-stone-500 mt-1 block">{t.task}</span>
                        <span className="text-[9px] text-stone-400 mt-0.5 block">Tech: {t.tech}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`text-[10px] font-bold uppercase ${
                          t.status === "completed" ? "text-emerald-500" : "text-amber-500"
                        }`}>
                          {t.status}
                        </span>
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
  }

  // LEVEL 1: Overview Grid of All Sites
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search and Filters toolbar */}
      <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-stone-200 dark:border-stone-800 bg-[#FFFBEB]/40 dark:bg-stone-950/10">
        <div className="flex items-center gap-3 flex-1">
          <svg className="w-5 h-5 text-stone-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Site Name or Supervisor..."
            className="text-xs bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded-md px-3 py-2 font-bold uppercase placeholder-stone-500 focus:outline-none focus:border-[#FFCD00] transition-colors flex-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded-md px-2 py-1.5 font-bold uppercase focus:outline-none focus:border-[#FFCD00]"
          >
            <option value="all">All Statuses</option>
            <option value="nominal">Nominal</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded-md px-2 py-1.5 font-bold uppercase focus:outline-none focus:border-[#FFCD00]"
          >
            <option value="all">All Health indexes</option>
            <option value="high">High (&gt;= 90%)</option>
            <option value="medium">Medium (80% - 89%)</option>
            <option value="low">Low (&lt; 80%)</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded-md px-2 py-1.5 font-bold uppercase focus:outline-none focus:border-[#FFCD00]"
          >
            <option value="health-desc">Health (High to Low)</option>
            <option value="health-asc">Health (Low to High)</option>
            <option value="machines-desc">Total Machines (Desc)</option>
            <option value="name-asc">Site Name (A-Z)</option>
          </select>
        </div>
      </Card>

      {/* Overview Cards list */}
      {filteredSites.length === 0 ? (
        <Card className="p-8 text-center border-stone-200 dark:border-stone-800">
          <p className="text-sm font-bold uppercase tracking-wider text-stone-400">No Sites Found</p>
          <p className="text-xs text-stone-500 mt-1">Adjust search parameters or filter configurations.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSites.map((site) => (
            <Card
              key={site.id}
              className="border-stone-200 dark:border-stone-800 hover:border-[#FFCD00] transition-all group overflow-hidden relative"
            >
              <div className="h-1 bg-stone-200 dark:bg-stone-800 group-hover:bg-[#FFCD00] transition-colors" />
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-md font-bold text-stone-900 dark:text-stone-50 uppercase tracking-wide">{site.name}</h3>
                    <p className="text-[10px] text-stone-400 font-mono mt-0.5">{site.location}</p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(site.status)}>
                    {site.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center py-2 bg-stone-50 dark:bg-stone-950/40 rounded border border-stone-100 dark:border-stone-900">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-stone-400 block">Health Index</span>
                    <span className={`text-sm font-extrabold ${
                      site.health >= 90 ? "text-emerald-500" : site.health >= 80 ? "text-amber-500" : "text-red-500"
                    }`}>{site.health}%</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-stone-400 block">Machines / Equip</span>
                    <span className="text-sm font-extrabold text-stone-800 dark:text-stone-200">{site.totalMachines} / {site.totalMachines * 3}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-stone-400 block">Active Alarms</span>
                    <span className={`text-sm font-extrabold ${site.activeAlerts > 0 ? "text-amber-500" : "text-stone-500"}`}>
                      {site.activeAlerts}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-stone-400 block">Critical Units</span>
                    <span className={`text-sm font-extrabold ${site.offlineMachines > 0 ? "text-red-500" : "text-stone-500"}`}>
                      {site.offlineMachines}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-stone-500 font-bold border-t border-stone-100 dark:border-stone-900/60 pt-3">
                  <div>
                    <span className="font-semibold">Supervisor: </span>
                    <span className="text-stone-700 dark:text-stone-300 font-extrabold">{site.supervisor}</span>
                  </div>
                  <Button
                    onClick={() => setSelectedSiteId(site.id)}
                    variant="primary"
                    className="h-7 px-3 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    Open Workspace
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
