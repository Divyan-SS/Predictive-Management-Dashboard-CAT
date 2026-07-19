import { API_URL, WS_URL } from "@/config/env";
import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SharedTask } from "./maintenance-command-center";

interface ServiceOperationsProps {
  tasks: SharedTask[];
  setTasks: React.Dispatch<React.SetStateAction<SharedTask[]>>;
  completedHistory: any[];
  setCompletedHistory: React.Dispatch<React.SetStateAction<any[]>>;
  timeline: any[];
  setTimeline: React.Dispatch<React.SetStateAction<any[]>>;
  refreshTasks?: () => Promise<void>;
}

export const ServiceOperations: React.FC<ServiceOperationsProps> = ({
  tasks,
  setTasks,
  completedHistory,
  setCompletedHistory,
  timeline,
  setTimeline,
  refreshTasks
}) => {
  // Selected Card IDs
  const [selectedTaskId, setSelectedTaskId] = useState<string>("task-1");
  const [dialogTaskId, setDialogTaskId] = useState<string | null>(null);

  // Dialog Form Input States
  const [completionNotes, setCompletionNotes] = useState<string>("");
  const [partsReplaced, setPartsReplaced] = useState<string>("");
  const [repairCost, setRepairCost] = useState<string>("");
  const [timeTaken, setTimeTaken] = useState<string>("");

  // History Filter States
  const [histSearch, setHistSearch] = useState<string>("");
  const [histSiteFilter, setHistSiteFilter] = useState<string>("all");
  const [histSort, setHistSort] = useState<string>("recent");

  // Selected Task Resolver
  const selectedTask = useMemo(() => {
    return tasks.find(t => t.id === selectedTaskId) || null;
  }, [selectedTaskId, tasks]);

  // KPI Calculations
  const kpiStats = useMemo(() => {
    // Exclude completed/history items. Display currently assigned active tasks
    const activeTasks = tasks.filter(t => t.status !== "Completed");
    const assigned = activeTasks.length;
    const notStarted = activeTasks.filter(t => t.status === "Not Started").length;
    const inProgress = activeTasks.filter(t => t.status === "In Progress" || t.status === "Assigned").length;
    const awaitingInspection = activeTasks.filter(t => t.status === "Awaiting Inspection").length;
    const completedToday = completedHistory.filter(h => h.status === "Completed").length;

    return { assigned, notStarted, inProgress, awaitingInspection, completedToday };
  }, [tasks, completedHistory]);

  // Right Sidebar calculations
  const sidebarSummary = useMemo(() => {
    const assigned = tasks.filter(t => t.status !== "Completed").length;
    const completed = completedHistory.length;
    const criticalJobs = tasks.filter(t => t.priority === "Critical" && t.status !== "Completed").length;

    return {
      assigned,
      completed,
      criticalJobs,
      avgRepairTime: "1h 35m",
      avgResponseTime: "12 mins"
    };
  }, [tasks, completedHistory]);

  // Color Map helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Not Started": return "bg-stone-500/10 text-stone-500 border border-stone-500/20";
      case "In Progress": return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "Awaiting Inspection": return "bg-purple-500/10 text-purple-500 border border-purple-500/20";
      case "Returned For Rework": return "bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse";
      case "Completed": return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      default: return "bg-stone-850 text-stone-400";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "Critical": return "text-red-500 border-red-500/30 bg-red-500/10";
      case "High": return "text-amber-500 border-amber-500/30 bg-amber-500/10";
      case "Medium": return "text-[#FFCD00] border-[#FFCD00]/30 bg-[#FFCD00]/10";
      case "Low": return "text-blue-500 border-blue-500/30 bg-blue-500/10";
      default: return "text-stone-400";
    }
  };

  // Actions handlers
  const handleStartWork = async (taskId: string) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedHistory = [
      ...(targetTask.statusHistory || []),
      { status: "Work Started", timestamp: timeStr }
    ];

    try {
      const res = await fetch(`${API_URL}/api/maintenance/work-orders/${taskId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          status_history: updatedHistory
        })
      });

      if (res.ok) {
        if (refreshTasks) {
          await refreshTasks();
        }
      }
    } catch (err) {
      console.error("Error starting work:", err);
    }
  };

  // Modal Dialog Form submit handler
  const handleConfirmCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialogTaskId) return;

    const targetTask = tasks.find(t => t.id === dialogTaskId);
    if (!targetTask) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedHistory = [
      ...(targetTask.statusHistory || []),
      { status: "Service Completed", timestamp: timeStr },
      { status: "Inspection Pending", timestamp: timeStr }
    ];

    try {
      const res = await fetch(`${API_URL}/api/maintenance/work-orders/${dialogTaskId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "SERVICE_COMPLETED",
          inspection_status: "PENDING",
          engineer_notes: completionNotes,
          parts_replaced: partsReplaced ? partsReplaced.split(",").map(p => p.trim()) : [],
          repair_cost: repairCost || "$1,240",
          time_taken: timeTaken || "2 Hours",
          completion_time: timeStr,
          service_engineer: "Maria Vance",
          status_history: updatedHistory
        })
      });

      if (res.ok) {
        setTimeline(prev => [
          { time: timeStr, text: `Repair Completed: ${targetTask?.machineCode} Submitted for Inspection` },
          ...prev
        ]);

        setDialogTaskId(null);
        setCompletionNotes("");
        setPartsReplaced("");
        setRepairCost("");
        setTimeTaken("");

        if (refreshTasks) {
          await refreshTasks();
        }
      }
    } catch (err) {
      console.error("Error completing service:", err);
    }
  };

  // History filters computation
  const filteredHistory = useMemo(() => {
    let result = [...completedHistory];

    if (histSearch.trim() !== "") {
      const q = histSearch.toLowerCase().replace(/\s+/g, "");
      result = result.filter(r => r.machine.toLowerCase().replace(/\s+/g, "").includes(q));
    }

    if (histSiteFilter !== "all") {
      result = result.filter(r => r.site === histSiteFilter);
    }

    if (histSort === "cost-asc") {
      result.sort((a, b) => {
        const valA = parseFloat(a.cost.replace(/[$,]/g, "")) || 0;
        const valB = parseFloat(b.cost.replace(/[$,]/g, "")) || 0;
        return valA - valB;
      });
    } else if (histSort === "cost-desc") {
      result.sort((a, b) => {
        const valA = parseFloat(a.cost.replace(/[$,]/g, "")) || 0;
        const valB = parseFloat(b.cost.replace(/[$,]/g, "")) || 0;
        return valB - valA;
      });
    }

    return result;
  }, [completedHistory, histSearch, histSiteFilter, histSort]);

  // Display only tasks assigned to Service (excludes completed tasks)
  const activeServiceTasks = useMemo(() => {
    return tasks.filter(t => t.status !== "Completed");
  }, [tasks]);

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* SERVICE OPERATIONS CENTER HEADER & KPIs */}
      <div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#FFCD00]">Service Operations Center</span>
        <h2 className="text-lg font-bold text-stone-900 dark:text-stone-50">Service Operations Workspace</h2>
        <p className="text-xs text-stone-500 mt-1">Receive, progress, and complete assigned maintenance tasks.</p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 border-stone-200 dark:border-stone-800">
          <span className="text-[8px] text-stone-500 uppercase font-bold block">Assigned Tasks</span>
          <div className="text-xl font-extrabold text-stone-900 dark:text-stone-50 mt-1 font-mono">{kpiStats.assigned}</div>
        </Card>
        <Card className="p-4 border-stone-200 dark:border-stone-800">
          <span className="text-[8px] text-stone-500 uppercase font-bold block">Not Started</span>
          <div className="text-xl font-extrabold text-stone-400 mt-1 font-mono">{kpiStats.notStarted}</div>
        </Card>
        <Card className="p-4 border-stone-200 dark:border-stone-800">
          <span className="text-[8px] text-stone-500 uppercase font-bold block">In Progress</span>
          <div className="text-xl font-extrabold text-amber-500 mt-1 font-mono">{kpiStats.inProgress}</div>
        </Card>
        <Card className="p-4 border-stone-200 dark:border-stone-800">
          <span className="text-[8px] text-stone-500 uppercase font-bold block">Completed Today</span>
          <div className="text-xl font-extrabold text-emerald-500 mt-1 font-mono">{kpiStats.completedToday}</div>
        </Card>
        <Card className="p-4 border-stone-200 dark:border-stone-800">
          <span className="text-[8px] text-stone-500 uppercase font-bold block">Awaiting Inspection</span>
          <div className="text-xl font-extrabold text-purple-500 mt-1 font-mono">{kpiStats.awaitingInspection}</div>
        </Card>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column (Service cards list & details panel) */}
        <div className="lg:col-span-3 space-y-6">
          
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">ASSIGNED SERVICE TASKS</h3>
              <Badge variant="neutral">Items: {activeServiceTasks.length}</Badge>
            </div>

            {/* Service Task Cards List */}
            {activeServiceTasks.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">No assigned service tasks found.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeServiceTasks.map((task) => {
                  const isSelected = task.id === selectedTaskId;
                  const isCritical = task.priority === "Critical";
                  const isRework = task.status === "Returned For Rework";
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`p-4 rounded border cursor-pointer select-text transition-all flex flex-col justify-between gap-3 ${
                        isSelected 
                          ? "bg-stone-900 border-[#FFCD00]" 
                          : "bg-black border-stone-800 hover:border-stone-700"
                      } ${isCritical ? "shadow-[0_0_15px_rgba(239,68,68,0.15)] border-red-500/40" : ""} ${
                        isRework ? "border-red-500" : ""
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-xs font-extrabold text-stone-900 dark:text-stone-50 bg-stone-100 dark:bg-stone-900/60 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-800 w-fit">
                            {task.machineCode}
                          </h4>
                          <span className="text-[9px] text-stone-450 uppercase block font-bold mt-1.5">{task.machineName}</span>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                          <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded mt-1.5 ${getStatusColor(task.status)}`}>
                            {task.status === "Returned For Rework" ? "REWORK REQUIRED" : task.status}
                          </span>
                        </div>
                      </div>

                      {/* Display Rework comments if returned */}
                      {isRework && task.inspectionComments && (
                        <div className="p-2.5 bg-red-500/5 border border-red-500/10 rounded text-[11px] text-red-400 font-semibold leading-relaxed">
                          <strong>Inspection Feedback:</strong> {task.inspectionComments}
                        </div>
                      )}

                      <div className="text-xs space-y-1 my-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-stone-400">Assigned By:</span>
                          <span className="font-bold text-stone-300">{task.assignedBy}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-stone-400">ETA:</span>
                          <span className="font-bold text-stone-300">{task.eta}</span>
                        </div>
                        <p className="text-[11px] text-stone-500 leading-normal line-clamp-2 mt-1">{task.problem}</p>
                      </div>

                      {/* Action buttons on card footer */}
                      <div className="flex gap-2 border-t border-stone-900 pt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTaskId(task.id);
                          }}
                          className="bg-stone-850 hover:bg-stone-800 text-stone-300 font-bold uppercase text-[9px] px-2 py-1 rounded"
                        >
                          Details
                        </button>

                        <button
                          type="button"
                          disabled={task.status !== "Not Started" && task.status !== "Returned For Rework"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartWork(task.id);
                          }}
                          className="bg-blue-650 hover:bg-blue-600 disabled:bg-stone-800 disabled:text-stone-500 text-white font-bold uppercase text-[9px] px-2.5 py-1 rounded"
                        >
                          {task.status === "Not Started" || task.status === "Returned For Rework" ? "Start Work" : "In Progress"}
                        </button>

                        <button
                          type="button"
                          disabled={task.status === "Not Started" || task.status === "Awaiting Inspection"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDialogTaskId(task.id);
                          }}
                          className="bg-[#FFCD00] hover:bg-[#E6B800] disabled:bg-stone-850 disabled:text-stone-550 text-black font-extrabold uppercase text-[9px] px-2 py-1 rounded flex-1 text-center"
                        >
                          {task.status === "Awaiting Inspection" ? "AWAITING FINAL INSPECTION" : "Complete Service"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* SERVICE DETAILS PANEL */}
          {selectedTask && (
            <Card className="p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-stone-850 pb-3">
                  <div>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-[#FFCD00]">Asset Details & Diagnostics</span>
                    <h3 className="text-sm font-extrabold text-stone-800 dark:text-stone-100">{selectedTask.machineCode} - {selectedTask.machineName}</h3>
                  </div>
                  <Badge variant={selectedTask.status === "Awaiting Inspection" ? "neutral" : "info"}>
                    {selectedTask.status === "Awaiting Inspection" ? "AWAITING FINAL INSPECTION" : selectedTask.status === "Returned For Rework" ? "REWORK REQUIRED" : selectedTask.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                  <div className="p-2.5 bg-stone-950 rounded border border-stone-850">
                    <span className="text-[8px] text-stone-500 uppercase block font-bold">Temperature</span>
                    <span className="text-stone-200 font-extrabold text-xs mt-1 block">{selectedTask.temp}°C</span>
                  </div>
                  <div className="p-2.5 bg-stone-950 rounded border border-stone-850">
                    <span className="text-[8px] text-stone-500 uppercase block font-bold">Oil Pressure</span>
                    <span className="text-stone-200 font-extrabold text-xs mt-1 block">{selectedTask.oilPressure} PSI</span>
                  </div>
                  <div className="p-2.5 bg-stone-950 rounded border border-stone-850">
                    <span className="text-[8px] text-stone-500 uppercase block font-bold">Vibration</span>
                    <span className="text-stone-200 font-extrabold text-xs mt-1 block">{selectedTask.vibration} mm/s</span>
                  </div>
                  <div className="p-2.5 bg-stone-950 rounded border border-stone-850">
                    <span className="text-[8px] text-stone-500 uppercase block font-bold">Engine Hours</span>
                    <span className="text-stone-200 font-extrabold text-xs mt-1 block">{selectedTask.hours} Hrs</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                  <div className="space-y-3">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-450 block mb-1">Required Spare Parts:</span>
                      <p className="text-stone-300 font-bold">{(selectedTask.requiredParts || []).join(", ")}</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-450 block mb-1">Estimated Repair Time:</span>
                      <p className="text-stone-300 font-bold">{selectedTask.eta} (Estimated Downtime)</p>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-450 block mb-1">Problem Description:</span>
                      <p className="text-stone-400 leading-relaxed font-semibold">{selectedTask.problem}</p>
                    </div>
                  </div>

                  <div className="space-y-3 p-3 bg-stone-950 rounded border border-stone-850">
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#FFCD00] block mb-1">Repair Procedures:</span>
                    <ul className="space-y-2 text-xs">
                      {(selectedTask.instructions || []).map((inst, i) => (
                        <li key={i} className="flex gap-2 leading-relaxed text-stone-400 font-semibold">
                          <span className="text-[#FFCD00]">{i+1}.</span>
                          <p>{inst}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          )}

        </div>

        {/* Right Column: Sidebar (Today's Service Summary) */}
        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-stone-500">TODAY'S SERVICE SUMMARY</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-850">
                <span className="text-xs text-stone-400 font-semibold uppercase">Tasks Assigned</span>
                <span className="text-lg font-mono font-extrabold text-stone-100">{sidebarSummary.assigned}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-850">
                <span className="text-xs text-stone-400 font-semibold uppercase">Tasks Completed</span>
                <span className="text-lg font-mono font-extrabold text-emerald-500">{sidebarSummary.completed}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-850">
                <span className="text-xs text-stone-400 font-semibold uppercase">Critical Jobs</span>
                <span className="text-lg font-mono font-extrabold text-red-500">{sidebarSummary.criticalJobs}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-850">
                <span className="text-xs text-stone-400 font-semibold uppercase">Avg Repair Time</span>
                <span className="text-xs font-mono font-bold text-stone-300">{sidebarSummary.avgRepairTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-400 font-semibold uppercase">Avg Response Time</span>
                <span className="text-xs font-mono font-bold text-stone-300">{sidebarSummary.avgResponseTime}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* BOTTOM SECTION: SERVICE HISTORY */}
      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">SERVICE HISTORY</h3>

          {/* History filter row */}
          <div className="flex flex-col md:flex-row gap-2.5">
            <input
              type="text"
              value={histSearch}
              onChange={(e) => setHistSearch(e.target.value)}
              placeholder="Search by Machine Code..."
              className="text-xs bg-stone-50 dark:bg-stone-950 text-stone-750 dark:text-stone-350 border border-stone-200 dark:border-stone-850 rounded-md px-3 py-1.5 font-bold uppercase placeholder-stone-550 focus:outline-none focus:border-[#FFCD00] transition-colors flex-1"
            />

            <div className="flex gap-2 shrink-0">
              <select
                value={histSiteFilter}
                onChange={(e) => setHistSiteFilter(e.target.value)}
                className="text-xs bg-stone-50 dark:bg-stone-950 text-stone-750 dark:text-stone-350 border border-stone-200 dark:border-stone-850 rounded px-2.5 py-1.5 font-bold uppercase focus:outline-none"
              >
                <option value="all">All Sites</option>
                <option value="PSG CAS">PSG CAS</option>
                <option value="Decatur Facility">Decatur Facility</option>
                <option value="Tucson Proving Ground">Tucson Proving</option>
              </select>

              <select
                value={histSort}
                onChange={(e) => setHistSort(e.target.value)}
                className="text-xs bg-stone-50 dark:bg-stone-950 text-stone-750 dark:text-stone-350 border border-stone-200 dark:border-stone-850 rounded px-2.5 py-1.5 font-bold uppercase focus:outline-none"
              >
                <option value="recent">Recently Completed</option>
                <option value="cost-asc">Cost: Low &rarr; High</option>
                <option value="cost-desc">Cost: High &rarr; Low</option>
              </select>
            </div>
          </div>

          {/* History table */}
          {filteredHistory.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-6">No historical service logs matches.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 dark:bg-stone-950 text-stone-500 font-bold border-b border-stone-200 dark:border-stone-800 uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Machine</th>
                    <th className="p-4">Site Location</th>
                    <th className="p-4">Engineer</th>
                    <th className="p-4">Repair Type</th>
                    <th className="p-4">Completion Date</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4 text-center">Cost</th>
                    <th className="p-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 dark:divide-stone-800">
                  {filteredHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-900/10">
                      <td className="p-4 font-bold text-stone-800 dark:text-stone-200">{rec.machine}</td>
                      <td className="p-4 text-stone-450">{rec.site}</td>
                      <td className="p-4 font-bold text-stone-450">{rec.engineer}</td>
                      <td className="p-4 font-semibold text-stone-550">{rec.repairType}</td>
                      <td className="p-4 font-mono text-stone-450">{rec.completionDate}</td>
                      <td className="p-4 font-mono text-stone-450">{rec.duration}</td>
                      <td className="p-4 text-center font-mono font-extrabold text-stone-300">{rec.cost}</td>
                      <td className="p-4 text-right">
                        <Badge variant={rec.status === "Awaiting Inspection" ? "neutral" : "success"}>
                          {rec.status === "Awaiting Inspection" ? "Awaiting Final Inspection" : "Completed"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* CONFIRMATION COMPLETION DIALOG MODAL */}
      {dialogTaskId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md p-6 bg-black border border-stone-800 shadow-2xl space-y-4 animate-scale-in">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFCD00]">Service Completed?</h3>
              <p className="text-[11px] text-stone-500 mt-1">Enter work order completion details below to request final inspection.</p>
            </div>

            <form onSubmit={handleConfirmCompletion} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase">Completion Notes</label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Describe repair actions performed..."
                  rows={2}
                  required
                  className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase">Parts Replaced</label>
                <input
                  type="text"
                  value={partsReplaced}
                  onChange={(e) => setPartsReplaced(e.target.value)}
                  placeholder="e.g. Bearing casing replacement, synthetic lubrication fluid"
                  required
                  className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-400 uppercase">Repair Cost ($)</label>
                  <input
                    type="text"
                    value={repairCost}
                    onChange={(e) => setRepairCost(e.target.value)}
                    placeholder="e.g. $1240"
                    required
                    className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-400 uppercase">Time Taken</label>
                  <input
                    type="text"
                    value={timeTaken}
                    onChange={(e) => setTimeTaken(e.target.value)}
                    placeholder="e.g. 2 Hours"
                    required
                    className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDialogTaskId(null)}
                  className="w-1/2 bg-stone-850 hover:bg-stone-800 text-stone-400 font-bold uppercase text-[10px] py-2 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-[#FFCD00] hover:bg-[#E6B800] text-black font-extrabold uppercase text-[10px] py-2 rounded transition-colors"
                >
                  Confirm Completion
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
