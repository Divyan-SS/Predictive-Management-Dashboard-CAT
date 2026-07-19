import { API_URL, WS_URL } from "@/config/env";
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UnifiedSubsystemMonitor } from "@/components/dashboard/unified-subsystem-monitor";
interface SuperAdminDashboardProps {
  onTriggerMessage?: (managerId: string, context: string, body: string) => void;
}

interface SummaryData {
  machinery: {
    total: number;
    operational: number;
    warning: number;
    critical: number;
    maintenance: number;
    offline: number;
  };
  alerts: {
    total_active: number;
    critical_active: number;
    warning_active: number;
    info_active: number;
    total_resolved: number;
  };
  costs: {
    total_maintenance_cost: number;
    total_service_cost: number;
    total_combined_cost: number;
  };
  predictions: {
    total: number;
    pending_review: number;
    confirmed: number;
    dismissed: number;
    acted: number;
  };
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onTriggerMessage }) => {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [sitesCount, setSitesCount] = useState<number>(0);
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);

  const [activeMaintenanceTab, setActiveMaintenanceTab] = useState<"complete" | "inProgress">("complete");
  const [maintenanceSearch, setMaintenanceSearch] = useState<string>("");
  const [maintenanceSort, setMaintenanceSort] = useState<string>("newest");
  const [maintenanceCostSort, setMaintenanceCostSort] = useState<string>("none");

  const [dbSites, setDbSites] = useState<any[]>([]);
  const [dbMachines, setDbMachines] = useState<any[]>([]);
  const [dbAlerts, setDbAlerts] = useState<any[]>([]);
  const [dbTasks, setDbTasks] = useState<any[]>([]);

  // Fetch summary report metrics
  const fetchSummaryMetrics = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/machinery/reports/summary/`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error("Failed to fetch summary metrics:", err);
    }
  };

  // Fetch sites to get count
  const fetchSitesCount = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/machinery/sites/`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setSitesCount(list.length);
        setDbSites(list);
      }
    } catch (err) {
      console.error("Failed to fetch sites list:", err);
    }
  };

  // Fetch machines, alerts, tasks
  const fetchAllData = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const headers = { "Authorization": `Bearer ${token}` };

      const mRes = await fetch(`${API_URL}/api/machinery/machines/`, { headers });
      if (mRes.ok) {
        const data = await mRes.json();
        setDbMachines(Array.isArray(data) ? data : data.results || []);
      }

      const aRes = await fetch(`${API_URL}/api/telemetry/alerts/`, { headers });
      if (aRes.ok) {
        const data = await aRes.json();
        setDbAlerts(Array.isArray(data) ? data : data.results || []);
      }

      const tRes = await fetch(`${API_URL}/api/maintenance/work-orders/`, { headers });
      if (tRes.ok) {
        const data = await tRes.json();
        setDbTasks(Array.isArray(data) ? data : data.results || []);
      }
    } catch (err) {
      console.error("Failed to fetch general data:", err);
    }
  };

  useEffect(() => {
    fetchSummaryMetrics();
    fetchSitesCount();
    fetchAllData();
    const interval = setInterval(() => {
      fetchSummaryMetrics();
      fetchAllData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

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

  // Map backend stats to display format
  const stats = [
    { label: "Total Sites", value: String(sitesCount).padStart(2, '0'), trend: "Active site facilities", color: "text-[#FFCD00]" },
    { label: "Total Fleet Machines", value: summaryData ? String(summaryData.machinery.total) : "0", trend: "Live assets in DB", color: "text-stone-100" },
    { label: "Healthy Assets", value: summaryData ? String(summaryData.machinery.operational) : "0", trend: "Operating nominally", color: "text-emerald-500" },
    { label: "Warnings Active", value: summaryData ? String(summaryData.machinery.warning) : "0", trend: "Requires inspection", color: "text-amber-500" },
    { label: "Critical Shutdowns", value: summaryData ? String(summaryData.machinery.critical) : "0", trend: "Immediate attention", color: "text-red-500 animate-pulse" },
    { label: "Predicted Failures", value: summaryData ? String(summaryData.predictions.total) : "0", trend: "FastAPI ML Forecast", color: "text-[#FFCD00]" },
    { label: "Combined Maintenance", value: summaryData ? `$${summaryData.costs.total_combined_cost.toLocaleString()}` : "$0", trend: "System logged costs", color: "text-cyan-500" }
  ];

  // Dynamic distribution from DB status
  const machineDist = useMemo(() => {
    const distMap: Record<string, { count: number; totalHealth: number }> = {};
    dbMachines.forEach(m => {
      const site = m.site_name || "Global";
      const health = m.status === "operational" ? 95 : m.status === "warning" ? 75 : 45;
      if (!distMap[site]) {
        distMap[site] = { count: 0, totalHealth: 0 };
      }
      distMap[site].count += 1;
      distMap[site].totalHealth += health;
    });

    return Object.entries(distMap).map(([site, info]) => {
      const percentage = dbMachines.length > 0 ? ((info.count / dbMachines.length) * 100).toFixed(0) + "%" : "0%";
      const healthStr = (info.totalHealth / info.count).toFixed(1) + "%";
      return { site, count: info.count, percentage, health: healthStr };
    });
  }, [dbMachines]);

  const sitesOverview = useMemo(() => {
    return dbSites.map(s => {
      const siteMachines = dbMachines.filter(m => m.site === s.id || m.site_name === s.name);
      const totalHealth = siteMachines.reduce((sum, m) => sum + (m.status === "operational" ? 95 : m.status === "warning" ? 75 : 45), 0);
      const health = siteMachines.length > 0 ? Number((totalHealth / siteMachines.length).toFixed(1)) : 100;
      
      let status: "nominal" | "warning" | "critical" = "nominal";
      if (siteMachines.some(m => m.status === "critical")) {
        status = "critical";
      } else if (siteMachines.some(m => m.status === "warning")) {
        status = "warning";
      }

      return {
        name: s.name,
        manager: s.manager_name || "Unassigned",
        activeMachines: `${siteMachines.filter(m => m.status === "operational").length}/${siteMachines.length}`,
        health,
        status
      };
    });
  }, [dbSites, dbMachines]);

  // Mock Alert and Maintenance feeds linked to actual statuses
  const recentAlerts = useMemo(() => {
    return dbAlerts.slice(0, 5).map(a => ({
      machine: a.machine_name || "CAT Machine",
      site: a.machine_site || "Site",
      mode: a.message || "Alert Triggered",
      time: "Active",
      severity: a.severity as any
    }));
  }, [dbAlerts]);

  const recentActivities = useMemo(() => {
    return dbTasks.map(t => ({
      asset: t.machineCode || t.machine_name || "CAT Asset",
      task: t.problem || "Routine calibration",
      engineer: t.serviceEngineer || "Unassigned",
      cost: t.repair_cost ? `$${t.repair_cost.toLocaleString()}` : "$0",
      status: t.status === "Completed" ? "completed" : "in-progress",
      date: "Active",
      estCompletion: ""
    }));
  }, [dbTasks]);

  // Fleet Health Trend over last 10 days
  const healthTrendData = [88.1, 88.4, 87.9, 88.2, 88.5, 87.6, 88.0, 88.3, 88.1, 88.2];
  const chartWidth = 500;
  const chartHeight = 100;
  const trendPath = healthTrendData
    .map((val, i) => {
      const x = (i / (healthTrendData.length - 1)) * chartWidth;
      const y = chartHeight - ((val - 85) / 10) * chartHeight;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  const displayedMaintenanceList = useMemo(() => {
    let list = recentActivities.filter(act => {
      if (activeMaintenanceTab === "complete") {
        return act.status === "completed";
      } else {
        return act.status !== "completed";
      }
    });
    
    if (maintenanceSearch.trim()) {
      const normalizedQuery = maintenanceSearch.replace(/\s+/g, "").toLowerCase();
      list = list.filter(act => {
        const normalizedAsset = act.asset.replace(/\s+/g, "").toLowerCase();
        return normalizedAsset.includes(normalizedQuery);
      });
    }

    if (maintenanceCostSort === "lowToHigh") {
      list = [...list].sort((a, b) => {
        const valA = parseFloat(a.cost.replace(/[$,]/g, "")) || 0;
        const valB = parseFloat(b.cost.replace(/[$,]/g, "")) || 0;
        return valA - valB;
      });
    } else if (maintenanceCostSort === "highToLow") {
      list = [...list].sort((a, b) => {
        const valA = parseFloat(a.cost.replace(/[$,]/g, "")) || 0;
        const valB = parseFloat(b.cost.replace(/[$,]/g, "")) || 0;
        return valB - valA;
      });
    }

    if (maintenanceSort === "oldest") {
      list = [...list].reverse();
    }

    return list;
  }, [recentActivities, activeMaintenanceTab, maintenanceSearch, maintenanceSort, maintenanceCostSort]);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. Summary Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-3 border-stone-200 dark:border-stone-800 hover:border-[#FFCD00] transition-colors">
            <span className="text-[9px] uppercase tracking-wider text-stone-500 font-bold block">{stat.label}</span>
            <div className={`text-xl font-extrabold tracking-tight mt-1 ${stat.color}`}>
              {stat.value}
            </div>
            <p className="text-[8px] text-stone-400 mt-0.5">{stat.trend}</p>
          </Card>
        ))}
      </div>

      {/* 2. Middle Row: Graph + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sparkline Health trend */}
        <Card className="p-5 lg:col-span-2 flex flex-col justify-between">
          <div>
            <CardTitle className="text-xs uppercase tracking-wider text-stone-500 font-bold">Fleet Health Trend (10 Days)</CardTitle>
            <p className="text-xs text-stone-400 mt-1">Weighted failure probability score aggregation</p>
          </div>
          <div className="py-4">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-24 overflow-visible">
              <path
                d={trendPath}
                fill="none"
                stroke="#FFCD00"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {healthTrendData.map((val, i) => (
                <circle
                  key={i}
                  cx={(i / (healthTrendData.length - 1)) * chartWidth}
                  cy={chartHeight - ((val - 85) / 10) * chartHeight}
                  r={4}
                  className="fill-stone-900 dark:fill-stone-100 stroke-[#FFCD00] stroke-2 hover:r-6 transition-all cursor-pointer"
                >
                  <title>{`Day ${i+1}: ${val}%`}</title>
                </circle>
              ))}
            </svg>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-stone-400 pt-2 border-t border-stone-100 dark:border-stone-900">
            <span>10 Days Ago</span>
            <span>Today</span>
          </div>
        </Card>

        {/* Machine distribution per site */}
        <Card className="p-5">
          <CardTitle className="text-xs uppercase tracking-wider text-stone-500 font-bold mb-4">Asset Site distribution</CardTitle>
          {machineDist.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-8">No sites config loaded.</p>
          ) : (
            <div className="space-y-4">
              {machineDist.map((row) => (
                <div key={row.site} className="flex items-center justify-between text-xs pb-3 border-b border-stone-200 dark:border-stone-850 last:border-b-0 last:pb-0">
                  <div>
                    <span className="font-bold text-stone-900 dark:text-stone-50">{row.site}</span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">{row.count} Active Machines</span>
                  </div>
                  <div className="text-right">
                    <span className="font-extrabold text-[#FFCD00] block">{row.percentage}</span>
                    <span className="text-[10px] text-emerald-500 font-bold">Health: {row.health}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

      {/* 3. Bottom Row: Sites Overview + Alarms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sites operational roster */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="py-4">
              <CardTitle>Global Site Registry</CardTitle>
              <CardDescription>Caterpillar site rosters overview</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              {sitesOverview.length === 0 ? (
                <p className="text-xs text-stone-500 p-6 text-center">No active sites seeded in the registry.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-stone-950 text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider border-b border-stone-200 dark:border-stone-800">
                      <th className="py-3 px-5">Site Facility</th>
                      <th className="py-3 px-5">Manager</th>
                      <th className="py-3 px-5 text-center">Active Assets</th>
                      <th className="py-3 px-5 text-right">Avg Health</th>
                      <th className="py-3 px-5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                    {sitesOverview.map((site) => (
                      <tr key={site.name} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/25 transition-colors">
                        <td className="py-3 px-5 font-bold text-stone-900 dark:text-stone-100">{site.name}</td>
                        <td className="py-3 px-5 font-bold text-stone-500 dark:text-stone-400">{site.manager}</td>
                        <td className="py-3 px-5 text-center font-semibold font-mono text-stone-800 dark:text-stone-200">{site.activeMachines}</td>
                        <td className={`py-3 px-5 text-right font-extrabold ${
                          site.health >= 90 ? "text-emerald-500" : site.health >= 80 ? "text-amber-500" : "text-red-500"
                        }`}>{site.health}%</td>
                        <td className="py-3 px-5">
                          <div className="flex justify-center">
                            <Badge variant={site.status === "nominal" ? "success" : "warning"}>
                              {site.status}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>

        {/* Live alarms feed */}
        <Card className="p-4 flex flex-col justify-between">
          <div>
            <CardTitle className="text-xs uppercase tracking-wider text-stone-500 font-bold mb-3">Live Fleet Alarms</CardTitle>
            {recentAlerts.length === 0 ? (
              <div className="py-8 text-center text-[10px] text-stone-500 font-bold uppercase">No Active Alarms</div>
            ) : (
              <div className="space-y-3.5">
                {recentAlerts.map((alert, i) => (
                  <div key={i} className="flex items-center justify-between text-xs pb-3 border-b border-stone-200 dark:border-stone-850 last:border-b-0 last:pb-0">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 dark:text-stone-50 truncate block">{alert.machine}</span>
                        <span className="text-[9px] text-stone-400 shrink-0 font-mono">{alert.site}</span>
                      </div>
                      <span className="text-[10px] text-amber-500 font-bold block mt-0.5 truncate">{alert.mode}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={alert.severity === "critical" ? "warning" : "neutral"}>
                        {alert.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

      </div>

      {/* 4. Bottom Activity Ledger */}
      <Card className="p-5">
        <div className="space-y-5">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
            <div>
              <CardTitle className="text-xs uppercase tracking-wider text-stone-500 font-bold">Fleet Maintenance Ledger</CardTitle>
              <CardDescription className="text-xs text-stone-400 mt-1">Audit trail of all diagnostic work orders</CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveMaintenanceTab("complete")}
                className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded transition-all duration-150 ${
                  activeMaintenanceTab === "complete"
                    ? "bg-[#FFCD00] text-black shadow-sm"
                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-250 bg-transparent"
                }`}
              >
                Complete
              </button>
              <button
                type="button"
                onClick={() => setActiveMaintenanceTab("inProgress")}
                className={`text-[10px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded transition-all duration-150 ${
                  activeMaintenanceTab === "inProgress"
                    ? "bg-[#FFCD00] text-black shadow-sm"
                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-250 bg-transparent"
                }`}
              >
                In Progress
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 xl:justify-end">
              <input
                type="text"
                value={maintenanceSearch}
                onChange={(e) => setMaintenanceSearch(e.target.value)}
                placeholder="Search by Machine Code..."
                className="text-[10px] bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded px-2.5 py-1.5 font-bold uppercase placeholder-stone-500 focus:outline-none focus:border-[#FFCD00] transition-colors flex-1 sm:max-w-xs"
              />

              <div className="flex gap-2 shrink-0">
                <select
                  value={maintenanceSort}
                  onChange={(e) => setMaintenanceSort(e.target.value)}
                  className="text-[10px] bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded px-2.5 py-1.5 font-bold uppercase cursor-pointer hover:border-stone-400 dark:hover:border-stone-700 focus:outline-none transition-colors"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>

                <select
                  value={maintenanceCostSort}
                  onChange={(e) => setMaintenanceCostSort(e.target.value)}
                  className="text-[10px] bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded px-2.5 py-1.5 font-bold uppercase cursor-pointer hover:border-stone-400 dark:hover:border-stone-700 focus:outline-none transition-colors"
                >
                  <option value="none">Cost: Default</option>
                  <option value="lowToHigh">Low → High</option>
                  <option value="highToLow">High → Low</option>
                </select>
              </div>
            </div>
          </div>

          {displayedMaintenanceList.length === 0 ? (
            <div className="text-center py-10 bg-stone-50/40 dark:bg-stone-950/20 rounded border border-dashed border-stone-200 dark:border-stone-800 p-4">
              <h4 className="text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                {activeMaintenanceTab === "complete" ? "No completed maintenance found" : "No in-progress maintenance found"}
              </h4>
            </div>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {displayedMaintenanceList.map((act, i) => (
                <div key={i} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-extrabold text-stone-900 dark:text-stone-50 bg-stone-100 dark:bg-stone-900/60 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-800">
                        {act.asset}
                      </span>
                      <span className="text-[9px] font-mono text-stone-400 dark:text-stone-505 font-bold">
                        Active
                      </span>
                    </div>
                    <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 leading-tight">
                      {act.task}
                    </h4>
                    <p className="text-[10px] text-stone-500">
                      Engineer: <span className="font-bold text-stone-600 dark:text-stone-400">{act.engineer}</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-stone-900 dark:text-stone-100 block">
                        {act.cost}
                      </span>
                    </div>
                    <div>
                      <Badge variant={activeMaintenanceTab === "complete" ? "success" : "warning"}>
                        {activeMaintenanceTab === "complete" ? "COMPLETED" : "IN PROGRESS"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Fleet Status Registry & Subsystem Monitoring */}
      {selectedMachineId ? (
        <Card className="p-5 border-stone-250 dark:border-stone-850">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-stone-200 dark:border-stone-800">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-500">Live Asset Subsystem Diagnostics</h3>
            <button 
              onClick={() => setSelectedMachineId(null)}
              className="text-xs font-extrabold text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition-colors uppercase tracking-wider"
            >
              Close Diagnostics [X]
            </button>
          </div>
          <UnifiedSubsystemMonitor machineId={selectedMachineId} />
        </Card>
      ) : (
        <Card className="p-5">
          <CardHeader className="py-2 px-0 mb-4">
            <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-stone-500">Super Admin Fleet Status Registry</CardTitle>
            <CardDescription className="text-xs text-stone-400 mt-1">Select any heavy machinery asset to launch real-time subsystem telemetry monitors</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {dbMachines.map((m) => {
              return (
                <div 
                  key={m.id}
                  onClick={() => setSelectedMachineId(m.id)}
                  className="p-4 bg-stone-50 dark:bg-stone-950/60 rounded border border-stone-200 dark:border-stone-800 hover:border-[#FFCD00] cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold text-stone-400 font-mono uppercase">{m.serial_number}</span>
                    <Badge variant={m.status === "operational" ? "success" : m.status === "warning" ? "warning" : "danger"}>
                      {m.status.toUpperCase()}
                    </Badge>
                  </div>
                  <h4 className="text-xs font-bold text-stone-800 dark:text-stone-200 mt-2">{m.name}</h4>
                  <p className="text-[10px] text-stone-500 mt-0.5">{m.model} | {m.site_name || "Peoria Site"}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

    </div>
  );
};
