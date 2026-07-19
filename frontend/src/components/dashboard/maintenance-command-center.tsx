import { API_URL, WS_URL } from "@/config/env";
import React, { useState, useMemo, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

// Shared Interfaces
export interface SharedTask {
  id: string;
  machineCode: string;
  machineName: string;
  site: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  assignedTime: string;
  eta: string;
  assignedBy: string;
  problem: string;
  status: "Waiting" | "Assigned" | "In Progress" | "Completed" | "Awaiting Inspection" | "Returned For Rework" | "Not Started" | "Work Started";
  temp: number;
  oilPressure: number;
  vibration: number;
  hours: number;
  rul: number;
  failureProbability: number;
  failurePrediction: string;
  requiredParts: string[];
  instructions: string[];
  engineerNotes: string;
  images: string[];
  aiRecommendations: string[];
  
  // Service Completion Fields
  completionNotes?: string;
  partsReplaced?: string;
  repairCost?: string;
  timeTaken?: string;
  inspectionComments?: string;
  
  // Health parameters
  healthBefore: number;
  healthAfter?: number;
  
  // Date params
  lastServiceDate: string;
  timeGenerated: string;

  // Real-time workflow additions
  inspectionStatus?: string;
  serviceEngineer?: string;
  completionTime?: string;
  statusHistory?: Array<{ status: string; timestamp: string }>;
}

interface MaintenanceCommandCenterProps {
  tasks: SharedTask[];
  setTasks: React.Dispatch<React.SetStateAction<SharedTask[]>>;
  completedHistory: any[];
  setCompletedHistory: React.Dispatch<React.SetStateAction<any[]>>;
  timeline: any[];
  setTimeline: React.Dispatch<React.SetStateAction<any[]>>;
  refreshTasks?: () => Promise<void>;
}

export const MaintenanceCommandCenter: React.FC<MaintenanceCommandCenterProps> = ({
  tasks,
  setTasks,
  completedHistory,
  setCompletedHistory,
  timeline,
  setTimeline,
  refreshTasks
}) => {
  // Command Center Navigation Tabs
  const [activeMaintTab, setActiveMaintTab] = useState<"alert-queue" | "final-inspection">("alert-queue");

  // Live Chat Notifications State
  interface Message {
    id: string;
    sender: string;
    sender_email: string;
    sender_name: string;
    recipient: string;
    recipient_email: string;
    recipient_name: string;
    site: string;
    machine_code: string;
    subject: string;
    body: string;
    is_read: boolean;
    status: string;
    created_at: string;
  }

  const { user } = useAuth();
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [replyBody, setReplyBody] = useState("");

  const fetchChatMessages = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications/messages/`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        setChatMessages(list);
      }
    } catch (err) {
      console.warn("Failed to fetch messages for maintenance view:", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchChatMessages();
      const interval = setInterval(fetchChatMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const unreadCount = useMemo(() => {
    return chatMessages.filter(m => m.sender_email !== user?.email && !m.is_read).length;
  }, [chatMessages, user]);

  const markAllAsRead = async () => {
    const unreadList = chatMessages.filter(m => m.sender_email !== user?.email && !m.is_read);
    for (const msg of unreadList) {
      try {
        await fetch(`${API_URL}/api/notifications/messages/${msg.id}/`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("access_token")}`
          },
          body: JSON.stringify({ is_read: true })
        });
      } catch (err) {
        console.warn("Error marking message as read:", err);
      }
    }
    fetchChatMessages();
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim()) return;

    let adminId = "super-admin";
    try {
      const res = await fetch(`${API_URL}/api/auth/users/`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`
        }
      });
      if (res.ok) {
        const users = await res.json();
        const list = Array.isArray(users) ? users : users.results || [];
        const adminObj = list.find((u: any) => u.email === "admin@cat.com");
        if (adminObj) {
          adminId = adminObj.id;
        }
      }
    } catch (err) {
      console.warn("Failed to lookup admin ID:", err);
    }

    const payload = {
      recipient: adminId,
      recipient_email: "admin@cat.com",
      body: replyBody,
      site: user?.assigned_site || "PSG CAS Site",
      machine_code: "",
      subject: "Direct Message",
      status: "Waiting for Reply"
    };

    try {
      const res = await fetch(`${API_URL}/api/notifications/messages/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("access_token")}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setReplyBody("");
        fetchChatMessages();
      }
    } catch (err) {
      console.error("Error sending message to Admin:", err);
    }
  };

  // Selected Card IDs
  const [selectedAlertId, setSelectedAlertId] = useState<string>("alert-1");
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>("");

  // Filters State (Tab 1: Alert Queue)
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [machineSearch, setMachineSearch] = useState<string>("");

  // Assignment Form State (Section 3 of Tab 1)
  const [assignedEngineer, setAssignedEngineer] = useState<string>("John Smith");
  const [assignedTeam, setAssignedTeam] = useState<string>("Team Alpha");
  const [assignPriority, setAssignPriority] = useState<string>("Medium");
  const [completionDate, setCompletionDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Inspection Checklist State
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    bearing: false,
    oil: false,
    temp: false,
    vibration: false,
    safety: false,
    functional: false,
    leakage: false,
    ready: false
  });

  const handleCheckboxChange = (key: string) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Rework remarks
  const [inspectionComments, setInspectionComments] = useState<string>("");

  // Priority mapping weight
  const priorityWeight = {
    "Critical": 4,
    "High": 3,
    "Medium": 2,
    "Low": 1
  };

  // Color Map helpers
  const getPriorityColor = (priority: "Critical" | "High" | "Medium" | "Low") => {
    switch (priority) {
      case "Critical": return "text-red-500 border-red-500/30 bg-red-500/10";
      case "High": return "text-amber-500 border-amber-500/30 bg-amber-500/10";
      case "Medium": return "text-[#FFCD00] border-[#FFCD00]/30 bg-[#FFCD00]/10";
      case "Low": return "text-blue-500 border-blue-500/30 bg-blue-500/10";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Waiting": return "bg-red-500/10 text-red-500 border border-red-500/25";
      case "Assigned": return "bg-amber-500/10 text-amber-500 border border-amber-500/25";
      case "In Progress": return "bg-blue-500/10 text-blue-500 border border-blue-500/25";
      case "Awaiting Inspection": return "bg-purple-500/10 text-purple-500 border border-purple-500/25";
      case "Returned For Rework": return "bg-red-500/10 text-red-500 border border-red-500/25";
      case "Completed": return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/25";
      default: return "bg-stone-850 text-stone-400";
    }
  };

  // ================= TAB 1 COMPUTATIONS =================
  const selectedAlert = useMemo(() => {
    return tasks.find(a => a.id === selectedAlertId) || null;
  }, [selectedAlertId, tasks]);

  const filteredAlerts = useMemo(() => {
    // Show only alerts waiting or assigned/in progress (not completed or waiting inspection)
    let result = tasks.filter(t => t.status === "Waiting" || t.status === "Assigned" || t.status === "In Progress" || t.status === "Returned For Rework");

    if (priorityFilter !== "all") {
      result = result.filter(a => a.priority === priorityFilter);
    }
    if (siteFilter !== "all") {
      result = result.filter(a => a.site === siteFilter);
    }
    if (machineSearch.trim() !== "") {
      const q = machineSearch.toLowerCase().replace(/\s+/g, "");
      result = result.filter(a => a.machineCode.toLowerCase().replace(/\s+/g, "").includes(q));
    }

    result.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);
    return result;
  }, [tasks, priorityFilter, siteFilter, machineSearch]);

  // ================= TAB 2 COMPUTATIONS =================
  const inspectionTasks = useMemo(() => {
    return tasks.filter(t => t.inspectionStatus === "PENDING" || t.status === "Awaiting Inspection");
  }, [tasks]);

  const selectedInspection = useMemo(() => {
    const activeList = inspectionTasks;
    const found = activeList.find(t => t.id === selectedInspectionId);
    if (found) return found;
    return activeList[0] || null;
  }, [selectedInspectionId, inspectionTasks]);

  // Dispatch Action handler (Tab 1)
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedHistory = [
      ...(selectedAlert.statusHistory || []),
      { status: "Assigned", timestamp: timeStr }
    ];

    try {
      const res = await fetch(`${API_URL}/api/maintenance/work-orders/${selectedAlert.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "NOT_STARTED",
          assigned_time: timeStr,
          assigned_by: "Maintenance Team",
          status_history: updatedHistory
        })
      });

      if (res.ok) {
        setTimeline(prev => [
          { time: timeStr, text: `Job Assigned to ${assignedTeam} for ${selectedAlert.machineCode}` },
          ...prev
        ]);
        setNotes("");
        if (refreshTasks) {
          await refreshTasks();
        }
      }
    } catch (err) {
      console.error("Error assigning task:", err);
    }
  };

  // Approve Repair handler (Tab 2)
  const handleApproveRepair = async () => {
    if (!selectedInspection) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedHistory = [
      ...(selectedInspection.statusHistory || []),
      { status: "Inspection Passed", timestamp: timeStr },
      { status: "Closed", timestamp: timeStr }
    ];

    try {
      const res = await fetch(`${API_URL}/api/maintenance/work-orders/${selectedInspection.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CLOSED",
          inspection_status: "PASSED",
          status_history: updatedHistory
        })
      });

      if (res.ok) {
        // 1. Add record to Completed History list
        const historyItem = {
          id: `hist-${Date.now()}`,
          machine: selectedInspection.machineCode,
          site: selectedInspection.site,
          engineer: selectedInspection.serviceEngineer || "Maria Lopez (Service)",
          repairType: selectedInspection.partsReplaced || "Standard Servicing",
          completionDate: new Date().toISOString().split('T')[0],
          cost: selectedInspection.repairCost || "$1,240",
          duration: selectedInspection.timeTaken || "2 Hours",
          status: "Completed",
          healthAfter: selectedInspection.healthAfter || 91
        };
        setCompletedHistory(prev => [historyItem, ...prev]);

        // 2. Add to timeline
        setTimeline(prev => [
          { time: timeStr, text: `Work Order Closed for ${selectedInspection.machineCode}` },
          { time: timeStr, text: `Repair Approved by Maintenance Team on ${selectedInspection.machineCode}` },
          ...prev
        ]);

        // 3. Reset checklist
        setChecklist({
          bearing: false,
          oil: false,
          temp: false,
          vibration: false,
          safety: false,
          functional: false,
          leakage: false,
          ready: false
        });

        if (refreshTasks) {
          await refreshTasks();
        }
      }
    } catch (err) {
      console.error("Error approving repair:", err);
    }
  };

  // Return to Service Rework handler (Tab 2)
  const handleReturnToService = async () => {
    if (!selectedInspection || !inspectionComments.trim()) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedHistory = [
      ...(selectedInspection.statusHistory || []),
      { status: "Inspection Failed", timestamp: timeStr },
      { status: "Reopened", timestamp: timeStr }
    ];

    try {
      const res = await fetch(`${API_URL}/api/maintenance/work-orders/${selectedInspection.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REOPENED",
          inspection_status: "FAILED",
          engineer_notes: inspectionComments,
          status_history: updatedHistory
        })
      });

      if (res.ok) {
        setTimeline(prev => [
          { time: timeStr, text: `Rework Required: Returned ${selectedInspection.machineCode} to Service Team` },
          ...prev
        ]);
        setInspectionComments("");
        if (refreshTasks) {
          await refreshTasks();
        }
      }
    } catch (err) {
      console.error("Error returning to service:", err);
    }
  };

  // Sidebar metrics computation
  const rightSidebarMetrics = useMemo(() => {
    const awaitingCount = tasks.filter(t => t.status === "Awaiting Inspection").length;
    const approvedTodayCount = completedHistory.filter(h => h.status === "Completed").length;
    const returnedCount = tasks.filter(t => t.status === "Returned For Rework").length;
    const criticalWaitingCount = tasks.filter(t => t.status === "Awaiting Inspection" && t.priority === "Critical").length;

    return {
      awaiting: awaitingCount,
      approved: approvedTodayCount,
      returned: returnedCount,
      avgInspectionTime: "14 mins",
      criticalWaiting: criticalWaitingCount
    };
  }, [tasks, completedHistory]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Dynamic Tab Controls & Message Notification */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-stone-900/60 p-1 rounded-md border border-stone-200 dark:border-stone-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveMaintTab("alert-queue")}
            className={`text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded transition-all duration-150 ${
              activeMaintTab === "alert-queue"
                ? "bg-[#FFCD00] text-black shadow-sm"
                : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-250 bg-transparent"
            }`}
          >
            Alert Queue
          </button>
          <button
            type="button"
            onClick={() => setActiveMaintTab("final-inspection")}
            className={`text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded transition-all duration-150 flex items-center gap-1.5 ${
              activeMaintTab === "final-inspection"
                ? "bg-[#FFCD00] text-black shadow-sm"
                : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-250 bg-transparent"
            }`}
          >
            Final Inspection
            {inspectionTasks.length > 0 && (
              <span className="bg-red-500 text-white font-mono text-[8px] font-extrabold px-1 rounded-full animate-pulse">
                {inspectionTasks.length}
              </span>
            )}
          </button>
        </div>

        {/* Message notification trigger button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setShowChatDrawer(true);
              markAllAsRead();
            }}
            className="relative p-2.5 rounded-full bg-stone-950 hover:bg-stone-900 border border-stone-850 hover:border-[#FFCD00]/50 text-stone-400 hover:text-[#FFCD00] transition-all duration-200 cursor-pointer shadow-md active:scale-95 flex items-center justify-center"
            title="Open Site Communications with Admin"
          >
            <span className="text-base">💬</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-605 text-white text-[8px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-bounce border border-stone-950">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Actions */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* ================= TAB 1: ALERT QUEUE ================= */}
          {activeMaintTab === "alert-queue" && (
            <>
              {/* Alert Queue Card */}
              <Card className="p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">MAINTENANCE ALERT QUEUE</h3>
                    <Badge variant="neutral">Items: {filteredAlerts.length}</Badge>
                  </div>

                  {/* Filters row */}
                  <div className="flex flex-col md:flex-row gap-2.5">
                    <input
                      type="text"
                      value={machineSearch}
                      onChange={(e) => setMachineSearch(e.target.value)}
                      placeholder="Search machine (e.g. CAT730)..."
                      className="text-xs bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded-md px-3 py-1.5 font-bold uppercase placeholder-stone-500 focus:outline-none focus:border-[#FFCD00] transition-colors flex-1"
                    />

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="text-xs bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded-md px-3 py-1.5 font-bold uppercase focus:outline-none"
                      >
                        <option value="all">All Priorities</option>
                        <option value="Critical">Critical Only</option>
                        <option value="High">High Only</option>
                        <option value="Medium">Medium Only</option>
                        <option value="Low">Low Only</option>
                      </select>

                      <select
                        value={siteFilter}
                        onChange={(e) => setSiteFilter(e.target.value)}
                        className="text-xs bg-stone-50 dark:bg-stone-950 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 rounded-md px-3 py-1.5 font-bold uppercase focus:outline-none"
                      >
                        <option value="all">All Sites</option>
                        <option value="PSG CAS">PSG CAS</option>
                        <option value="Decatur Facility">Decatur Facility</option>
                        <option value="Aurora Factory">Aurora Factory</option>
                        <option value="Tucson Proving Ground">Tucson Proving</option>
                      </select>
                    </div>
                  </div>

                  {/* Cards List */}
                  {filteredAlerts.length === 0 ? (
                    <p className="text-xs text-stone-400 text-center py-6">No pending priority alerts found.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredAlerts.map((al) => {
                        const isSelected = al.id === selectedAlertId;
                        const isCritical = al.priority === "Critical";
                        return (
                          <div
                            key={al.id}
                            onClick={() => setSelectedAlertId(al.id)}
                            className={`p-4 rounded border cursor-pointer select-text transition-all ${
                              isSelected 
                                ? "bg-stone-900 border-[#FFCD00] scale-[0.99]" 
                                : "bg-black border-stone-800 hover:border-stone-700"
                            } ${isCritical ? "shadow-[0_0_15px_rgba(239,68,68,0.2)] border-red-500/50" : ""}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <span className="text-xs font-mono font-extrabold text-stone-900 dark:text-stone-50 bg-stone-100 dark:bg-stone-900/60 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-800">
                                  {al.machineCode}
                                </span>
                                <span className="text-[9px] font-bold text-stone-450 uppercase block mt-1.5">Site: {al.site}</span>
                              </div>
                              <Badge className={getPriorityColor(al.priority)}>
                                {al.priority === "Critical" ? "🔴 CRITICAL" : al.priority}
                              </Badge>
                            </div>

                            <div className="my-3 space-y-1">
                              <div className="flex justify-between text-[10px] text-stone-400">
                                <span>Prediction Mode:</span>
                                <span className="font-bold text-red-400">{al.failurePrediction}</span>
                              </div>
                              <div className="flex justify-between text-[10px] text-stone-450">
                                <span>Failure Risk ETA:</span>
                                <span className="font-bold text-stone-250">{al.eta}</span>
                              </div>
                            </div>

                            {/* Sensor Readings Block */}
                            <div className="grid grid-cols-4 gap-1 text-center bg-stone-950/60 p-2 rounded border border-stone-900 text-[9px] font-mono mt-2 text-stone-400">
                              <div>
                                <span className="block text-[8px] text-stone-500 uppercase">Temp</span>
                                <span className="font-bold">{al.temp}°C</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-stone-500 uppercase">Oil PSI</span>
                                <span className="font-bold">{al.oilPressure}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-stone-500 uppercase">Vibe</span>
                                <span className="font-bold">{al.vibration}</span>
                              </div>
                              <div>
                                <span className="block text-[8px] text-stone-500 uppercase">RUL</span>
                                <span className="font-bold text-stone-200">{al.rul}h</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[8px] text-stone-500 font-mono mt-3">
                              <span>Health Level: {al.healthBefore}%</span>
                              <span className={`font-extrabold px-1.5 py-0.5 rounded ${getStatusColor(al.status)}`}>
                                {al.status === "Returned For Rework" ? "Rework" : al.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>

              {/* Detail & Assignment form block */}
              {selectedAlert && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Selected Alert Details */}
                  <Card className="p-5">
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">SELECTED ALERT DETAILS</h3>
                      
                      <div className="flex gap-4 items-center border-b border-stone-850 pb-3">
                        <div className="w-16 h-16 bg-stone-900 border border-stone-800 rounded flex items-center justify-center shrink-0">
                          <svg className="w-10 h-10 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-stone-800 dark:text-stone-100">{selectedAlert.machineCode}</h4>
                          <p className="text-[10px] text-stone-400 font-bold uppercase">Location: {selectedAlert.site}</p>
                          <div className="flex gap-4 text-[10px] text-stone-500 mt-1">
                            <span>Hours: <strong className="text-stone-300">{selectedAlert.hours}h</strong></span>
                            <span>Last Service: <strong className="text-stone-300">{selectedAlert.lastServiceDate}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-2.5 bg-stone-950 rounded border border-stone-850">
                          <span className="text-[8px] text-stone-500 uppercase block font-bold">Failure Probability</span>
                          <span className="text-sm font-extrabold text-red-500">{selectedAlert.failureProbability}% Risk</span>
                        </div>
                        <div className="p-2.5 bg-stone-950 rounded border border-stone-850">
                          <span className="text-[8px] text-stone-500 uppercase block font-bold">Health Level</span>
                          <span className="text-sm font-extrabold text-red-400">{selectedAlert.healthBefore}%</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-455">AI Diagnostics:</span>
                        <div className="p-3 bg-stone-950/60 rounded border border-stone-850 space-y-1.5 text-xs text-stone-300">
                          {(selectedAlert.aiRecommendations || []).map((rec, i) => (
                            <div key={i} className="flex items-start gap-1.5">
                              <span className="text-red-500 mt-0.5">&bull;</span>
                              <p>{rec}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Assign Service Team */}
                  <Card className="p-5">
                    <form onSubmit={handleAssign} className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">ASSIGN SERVICE TEAM</h3>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase">Assign Engineer</label>
                        <select
                          value={assignedEngineer}
                          onChange={(e) => setAssignedEngineer(e.target.value)}
                          className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 font-bold uppercase"
                        >
                          <option value="John Smith">John Smith (Mech)</option>
                          <option value="Alex Lopez">Alex Lopez (Elec)</option>
                          <option value="Maria Vance">Maria Vance (Hydr)</option>
                          <option value="Dave Jenkins">Dave Jenkins (Sys)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase">Assign Team</label>
                        <select
                          value={assignedTeam}
                          onChange={(e) => setAssignedTeam(e.target.value)}
                          className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 font-bold uppercase"
                        >
                          <option value="Team Alpha">Team Alpha</option>
                          <option value="Team Beta">Team Beta</option>
                          <option value="Team Gamma">Team Gamma</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-400 uppercase">Priority</label>
                          <select
                            value={assignPriority}
                            onChange={(e) => setAssignPriority(e.target.value)}
                            className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 font-bold uppercase"
                          >
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-400 uppercase">Target Date</label>
                          <input
                            type="date"
                            value={completionDate}
                            onChange={(e) => setCompletionDate(e.target.value)}
                            className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2 py-1 font-mono uppercase focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-400 uppercase">Operational Notes</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Engineering guidelines..."
                          rows={2}
                          className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#FFCD00]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={selectedAlert.status === "Assigned" || selectedAlert.status === "In Progress"}
                        className="w-full bg-[#FFCD00] disabled:bg-stone-800 disabled:text-stone-500 hover:bg-[#E6B800] text-black font-extrabold uppercase text-[10px] tracking-wider py-2 rounded transition-colors"
                      >
                        {selectedAlert.status === "Assigned" || selectedAlert.status === "In Progress" ? "Job Dispatched" : "Dispatch Service Order →"}
                      </button>
                    </form>
                  </Card>
                </div>
              )}
            </>
          )}

          {/* ================= TAB 2: FINAL INSPECTION ================= */}
          {activeMaintTab === "final-inspection" && (
            <>
              {/* Inspection Queue */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">INSPECTION QUEUE</h3>
                  <Badge variant="neutral">Repaired: {inspectionTasks.length}</Badge>
                </div>

                {inspectionTasks.length === 0 ? (
                  <div className="text-center py-10 bg-stone-50/20 dark:bg-stone-950/10 rounded border border-dashed border-stone-250 dark:border-stone-800 p-4">
                    <h4 className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
                      No machines awaiting inspection
                    </h4>
                    <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 max-w-[240px] mx-auto normal-case">
                      Service teams must complete active work orders before they appear in this queue.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inspectionTasks.map((task) => {
                      const isSelected = task.id === selectedInspectionId || (!selectedInspectionId && inspectionTasks[0]?.id === task.id);
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedInspectionId(task.id)}
                          className={`p-4 rounded border cursor-pointer select-text transition-all flex flex-col justify-between gap-3 ${
                            isSelected 
                              ? "bg-stone-900 border-[#FFCD00]" 
                              : "bg-black border-stone-800 hover:border-stone-700"
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-xs font-mono font-extrabold text-stone-900 dark:text-stone-50 bg-stone-100 dark:bg-stone-900/60 px-2 py-0.5 rounded border border-stone-200 dark:border-stone-800">
                                {task.machineCode}
                              </span>
                              <span className="text-[9px] font-bold text-stone-450 uppercase block mt-1.5">Site: {task.site}</span>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              <Badge variant="info">Repaired</Badge>
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded mt-1 bg-purple-500/10 text-purple-500 border border-purple-500/25">
                                Awaiting Inspection
                              </span>
                            </div>
                          </div>

                          <div className="text-xs space-y-1 font-mono text-stone-400">
                            <div className="flex justify-between text-[10px]">
                              <span>Engineer:</span>
                              <span className="font-bold text-stone-250">{task.engineerNotes ? "Maria Lopez" : "John Smith"}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span>Completed:</span>
                              <span className="font-bold text-stone-250">{task.assignedTime}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span>Cost:</span>
                              <span className="font-bold text-stone-200">{task.repairCost || "$1,240"}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span>Health After:</span>
                              <span className="font-extrabold text-emerald-500">{task.healthAfter || 91}%</span>
                            </div>
                          </div>

                          <div className="border-t border-stone-900 pt-2 text-[10px] text-stone-500 font-semibold line-clamp-2">
                            Remarks: {task.completionNotes || "Replaced front wheel axle roller casing assembly."}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Inspection Details Panel */}
              {selectedInspection && (
                <Card className="p-5">
                  <div className="space-y-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">INSPECTION DETAILS</h3>
                    
                    <div className="flex gap-4 items-center border-b border-stone-850 pb-3 text-xs">
                      <div className="w-12 h-12 bg-stone-900 border border-stone-850 rounded flex items-center justify-center shrink-0">
                        <svg className="w-8 h-8 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-extrabold text-stone-800 dark:text-stone-100">{selectedInspection.machineCode}</h4>
                        <p className="text-[10px] text-stone-500 font-bold uppercase">Original Alert: {selectedInspection.failurePrediction}</p>
                        <p className="text-[9px] text-stone-450 mt-0.5">Duration: {selectedInspection.timeTaken || "2 Hours"} | Cost: {selectedInspection.repairCost || "$1,240"}</p>
                      </div>
                    </div>

                    {/* Telemetry Comparison Table */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-450 block">Telemetry Comparison:</span>
                      <div className="overflow-x-auto text-[10px] font-mono">
                        <table className="w-full text-left">
                          <thead className="bg-stone-950 text-stone-500 font-bold">
                            <tr>
                              <th className="p-2">Metric</th>
                              <th className="p-2 text-center">Before Repair</th>
                              <th className="p-2 text-center text-[#FFCD00]">After Repair</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-900">
                            <tr>
                              <td className="p-2 text-stone-400">Temperature</td>
                              <td className="p-2 text-center text-stone-500">{selectedInspection.temp}°C</td>
                              <td className="p-2 text-center text-emerald-500">64°C (Stable)</td>
                            </tr>
                            <tr>
                              <td className="p-2 text-stone-400">Oil Pressure</td>
                              <td className="p-2 text-center text-stone-500">{selectedInspection.oilPressure} PSI</td>
                              <td className="p-2 text-center text-emerald-500">42 PSI (Normal)</td>
                            </tr>
                            <tr>
                              <td className="p-2 text-stone-400">Vibration</td>
                              <td className="p-2 text-center text-stone-500">{selectedInspection.vibration} mm/s</td>
                              <td className="p-2 text-center text-emerald-500">1.1 mm/s (Within Limit)</td>
                            </tr>
                            <tr>
                              <td className="p-2 text-stone-400">Overall Health</td>
                              <td className="p-2 text-center text-red-500">{selectedInspection.healthBefore}%</td>
                              <td className="p-2 text-center text-emerald-500 font-bold">{selectedInspection.healthAfter || 91}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Repair comments */}
                    <div className="text-xs space-y-1">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-450 block">Service Team Remarks:</span>
                      <p className="p-3 bg-stone-950 rounded border border-stone-850 text-stone-400 font-semibold leading-relaxed">
                        {selectedInspection.completionNotes || "Cleaned housing core, installed advanced bearing and lubricated cylinder shaft. Run cycle confirmed temperature and vibrations have settled to baseline ratios."}
                      </p>
                    </div>

                    {/* SECTION: MAINTENANCE INSPECTION CHECKLIST */}
                    <div className="space-y-3">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-[#FFCD00] block">MAINTENANCE INSPECTION CHECKLIST</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <label className="flex items-center gap-2.5 p-2 bg-stone-950/60 rounded border border-stone-850 cursor-pointer select-text">
                          <input
                            type="checkbox"
                            checked={checklist.bearing}
                            onChange={() => handleCheckboxChange("bearing")}
                            className="w-4 h-4 rounded accent-[#FFCD00]"
                          />
                          <span>Bearing properly installed</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-2 bg-stone-950/60 rounded border border-stone-850 cursor-pointer select-text">
                          <input
                            type="checkbox"
                            checked={checklist.oil}
                            onChange={() => handleCheckboxChange("oil")}
                            className="w-4 h-4 rounded accent-[#FFCD00]"
                          />
                          <span>Oil pressure normal</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-2 bg-stone-950/60 rounded border border-stone-850 cursor-pointer select-text">
                          <input
                            type="checkbox"
                            checked={checklist.temp}
                            onChange={() => handleCheckboxChange("temp")}
                            className="w-4 h-4 rounded accent-[#FFCD00]"
                          />
                          <span>Temperature stable</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-2 bg-stone-950/60 rounded border border-stone-850 cursor-pointer select-text">
                          <input
                            type="checkbox"
                            checked={checklist.vibration}
                            onChange={() => handleCheckboxChange("vibration")}
                            className="w-4 h-4 rounded accent-[#FFCD00]"
                          />
                          <span>Vibration within threshold</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-2 bg-stone-950/60 rounded border border-stone-850 cursor-pointer select-text">
                          <input
                            type="checkbox"
                            checked={checklist.safety}
                            onChange={() => handleCheckboxChange("safety")}
                            className="w-4 h-4 rounded accent-[#FFCD00]"
                          />
                          <span>Safety inspection completed</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-2 bg-stone-950/60 rounded border border-stone-850 cursor-pointer select-text">
                          <input
                            type="checkbox"
                            checked={checklist.functional}
                            onChange={() => handleCheckboxChange("functional")}
                            className="w-4 h-4 rounded accent-[#FFCD00]"
                          />
                          <span>Functional test passed</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-2 bg-stone-950/60 rounded border border-stone-850 cursor-pointer select-text">
                          <input
                            type="checkbox"
                            checked={checklist.leakage}
                            onChange={() => handleCheckboxChange("leakage")}
                            className="w-4 h-4 rounded accent-[#FFCD00]"
                          />
                          <span>No leakage detected</span>
                        </label>
                        <label className="flex items-center gap-2.5 p-2 bg-stone-950/60 rounded border border-stone-850 cursor-pointer select-text">
                          <input
                            type="checkbox"
                            checked={checklist.ready}
                            onChange={() => handleCheckboxChange("ready")}
                            className="w-4 h-4 rounded accent-[#FFCD00]"
                          />
                          <span>Machine ready for operation</span>
                        </label>
                      </div>
                    </div>

                    {/* SECTION: INSPECTION DECISION & MANDATORY INPUT FOR REWORK */}
                    <div className="space-y-3 pt-3 border-t border-stone-850">
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-stone-450 block">INSPECTION DECISION & REMARKS:</span>
                      
                      <textarea
                        value={inspectionComments}
                        onChange={(e) => setInspectionComments(e.target.value)}
                        placeholder="Enter inspection feedback (MANDATORY if returning for rework)..."
                        rows={2}
                        className="w-full text-xs bg-stone-950 text-stone-300 border border-stone-850 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#FFCD00]"
                      />

                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={handleReturnToService}
                          disabled={!inspectionComments.trim()}
                          className="w-1/2 bg-red-600 hover:bg-red-500 disabled:bg-stone-850 disabled:text-stone-550 text-white font-bold uppercase text-[10px] tracking-wider py-2.5 rounded transition-colors"
                        >
                          Return to Service (Rework)
                        </button>

                        <button
                          type="button"
                          onClick={handleApproveRepair}
                          className="w-1/2 bg-[#FFCD00] hover:bg-[#E6B800] text-black font-extrabold uppercase text-[10px] tracking-wider py-2.5 rounded transition-colors"
                        >
                          Approve Repair (Close Order)
                        </button>
                      </div>
                    </div>

                  </div>
                </Card>
              )}
            </>
          )}

        </div>

        {/* Right Sidebar (Command Center Statistics & Timeline) */}
        <div className="space-y-6">
          
          {/* Inspection Summary / Statistics Card */}
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-stone-500">INSPECTION SUMMARY</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-850">
                <span className="text-xs text-stone-400 font-semibold uppercase">Awaiting Inspection</span>
                <span className="text-lg font-mono font-extrabold text-purple-500">{rightSidebarMetrics.awaiting}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-850">
                <span className="text-xs text-stone-400 font-semibold uppercase">Approved Today</span>
                <span className="text-lg font-mono font-extrabold text-emerald-500">{rightSidebarMetrics.approved}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-850">
                <span className="text-xs text-stone-400 font-semibold uppercase">Returned For Rework</span>
                <span className="text-lg font-mono font-extrabold text-red-500">{rightSidebarMetrics.returned}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-stone-850">
                <span className="text-xs text-stone-400 font-semibold uppercase">Avg Inspection Time</span>
                <span className="text-xs font-mono font-bold text-stone-300">{rightSidebarMetrics.avgInspectionTime}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-stone-400 font-semibold uppercase">Critical Waiting</span>
                <span className="text-xs font-mono font-bold text-red-400">{rightSidebarMetrics.criticalWaiting}</span>
              </div>
            </div>
          </Card>

          {/* Recent Activity Timeline */}
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-stone-500">RECENT ACTIVITY TIMELINE</h3>
            <div className="relative pl-4 border-l border-stone-800 space-y-4 text-xs">
              {timeline.map((event, idx) => (
                <div key={idx} className="relative">
                  <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center">
                    <span className="w-1 h-1 rounded-full bg-[#FFCD00]" />
                  </span>
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-mono text-stone-500 block font-bold">{event.time}</span>
                    <p className="text-stone-350 leading-relaxed font-semibold">{event.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

        </div>
      </div>

      {/* SIDE CHAT DRAWER */}
      {showChatDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-fade-in">
          {/* Backdrop click close */}
          <div className="flex-1" onClick={() => setShowChatDrawer(false)} />

          {/* Drawer body */}
          <div className="w-full max-w-md bg-stone-950 border-l border-stone-850 h-full flex flex-col shadow-2xl relative animate-slide-in">
            {/* Header */}
            <div className="p-4 border-b border-stone-850 bg-stone-905 flex justify-between items-center shrink-0">
              <div>
                <span className="text-[9px] uppercase font-extrabold tracking-widest text-[#FFCD00] block">
                  Site Communications
                </span>
                <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                  Admin Support Desk
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Online" />
                </h4>
                <p className="text-[10px] text-stone-500 font-bold uppercase mt-0.5">
                  Assigned Site: {user?.assigned_site || "N/A"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChatDrawer(false)}
                className="text-stone-500 hover:text-stone-250 text-xs font-bold p-1.5 cursor-pointer uppercase tracking-wider"
              >
                ✕ Close
              </button>
            </div>

            {/* Message Thread list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 ? (
                <div className="text-center py-20">
                  <span className="text-3xl block mb-2">💬</span>
                  <p className="text-xs text-stone-500 font-bold uppercase tracking-wider">
                    No communications recorded
                  </p>
                  <p className="text-[10px] text-stone-600 max-w-[280px] mx-auto mt-1">
                    Send updates regarding critical sensors, failure risks, or maintenance logs.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg) => {
                    const isOwn = msg.sender_email === user?.email;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[80%] ${
                          isOwn ? "ml-auto items-end" : "mr-auto items-start"
                        }`}
                      >
                        <span className="text-[9px] text-stone-500 font-bold mb-1">
                          {isOwn ? "You" : msg.sender_name} &bull; {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        <div
                          className={`p-3 rounded-lg text-xs leading-relaxed ${
                            isOwn
                              ? "bg-[#FFCD00] text-black rounded-tr-none font-semibold"
                              : "bg-stone-900 border border-stone-850 text-stone-200 rounded-tl-none"
                          }`}
                        >
                          {msg.machine_code && (
                            <span className="mb-2 block bg-black/40 text-stone-300 font-mono text-[9px] w-fit border border-stone-800 px-1 rounded">
                              Context: {msg.machine_code}
                            </span>
                          )}
                          <p>{msg.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Composer Footer */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-stone-850 bg-stone-900/60 shrink-0 space-y-3">
              <div className="flex gap-2">
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a message to Admin..."
                  rows={2}
                  className="flex-1 text-xs bg-stone-950 text-stone-200 border border-stone-850 rounded px-3 py-2 focus:outline-none focus:border-[#FFCD00] resize-none"
                />
                <button
                  type="submit"
                  disabled={!replyBody.trim()}
                  className="bg-[#FFCD00] hover:bg-[#E6B800] text-black font-extrabold uppercase text-[10px] px-4 rounded shrink-0 transition-all active:scale-95 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
