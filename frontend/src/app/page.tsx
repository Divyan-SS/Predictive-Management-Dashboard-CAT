"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { API_URL, WS_URL } from "@/config/env";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Chart } from "@/components/ui/chart";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin";
import { MachineDetails } from "@/components/dashboard/machine-details";
import { MaintenanceEngineerDashboard } from "@/components/dashboard/maintenance-engineer";
import { ServiceTeamDashboard } from "@/components/dashboard/service-team";
import { ReportsModule } from "@/components/dashboard/reports-module";
import { SitesWorkspace } from "@/components/dashboard/sites-workspace";
import { MaintenanceCommandCenter } from "@/components/dashboard/maintenance-command-center";
import { ServiceOperations } from "@/components/dashboard/service-operations";
import { MessagesWorkspace } from "@/components/dashboard/messages-workspace";

// Icons for Sidebar setup
const Icons = {
  Activity: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Palette: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  ),
  Check: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
};

const mapStatusToFrontend = (dbStatus: string): string => {
  if (dbStatus === "NOT_STARTED") return "Not Started";
  if (dbStatus === "IN_PROGRESS") return "In Progress";
  if (dbStatus === "SERVICE_COMPLETED") return "Awaiting Inspection";
  if (dbStatus === "CLOSED") return "Completed";
  if (dbStatus === "REOPENED") return "Returned For Rework";
  return dbStatus;
};

const mapStatusToBackend = (feStatus: string): string => {
  if (feStatus === "Not Started" || feStatus === "Assigned") return "NOT_STARTED";
  if (feStatus === "In Progress") return "IN_PROGRESS";
  if (feStatus === "Awaiting Inspection") return "SERVICE_COMPLETED";
  if (feStatus === "Completed" || feStatus === "Closed") return "CLOSED";
  if (feStatus === "Returned For Rework") return "REOPENED";
  return feStatus;
};

export default function Home() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [messagesPrefill, setMessagesPrefill] = useState<{
    managerId?: string;
    context?: string;
    body?: string;
  } | null>(null);

  const handleTriggerMessageToManager = (managerId: string, context: string, body: string) => {
    setMessagesPrefill({ managerId, context, body });
    setActiveTab("messages");
  };

  const { user, loading, logout, accessToken, updateUser } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [nameUpdateSaving, setNameUpdateSaving] = useState(false);
  const [nameUpdateError, setNameUpdateError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setNewName(user.name || "");
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Dynamic Landing Tab Setup
  useEffect(() => {
    if (user) {
      const roleName = user.role?.name;
      if (roleName === "Service Team") {
        setActiveTab("service");
      } else {
        setActiveTab("dashboard");
      }
    }
  }, [user]);

  const handleSaveName = async () => {
    if (!newName.trim()) {
      setNameUpdateError("Display name cannot be empty");
      return;
    }
    setNameUpdateSaving(true);
    setNameUpdateError(null);
    try {
      const response = await fetch(`${API_URL}/api/auth/profile/`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ name: newName })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update profile name.");
      }
      const updatedUser = await response.json();
      updateUser(updatedUser);
      setIsEditingName(false);
    } catch (err: any) {
      setNameUpdateError(err.message || "An error occurred while saving.");
    } finally {
      setNameUpdateSaving(false);
    }
  };

  // Tab guards / Authorization check
  const allowedTabs = useMemo(() => {
    if (!user) return [];
    const roleName = user.role?.name;
    if (roleName === "Super Admin") return ["dashboard", "sites", "reports", "messages", "profile"];
    if (roleName === "Maintenance Team") return ["dashboard", "maintenance", "profile"];
    if (roleName === "Service Team") return ["dashboard", "service", "profile"];
    return [];
  }, [user]);

  useEffect(() => {
    if (user && allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      const roleName = user.role?.name;
      if (roleName === "Maintenance Team") {
        setActiveTab("maintenance");
      } else if (roleName === "Service Team") {
        setActiveTab("service");
      } else {
        setActiveTab("dashboard");
      }
    }
  }, [activeTab, allowedTabs, user]);

  const userRole = (user?.role?.name || "Super Admin") as any;

  // Shared Service & Maintenance Workflow States
  const [sharedTasks, setSharedTasks] = useState<any[]>([]);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/maintenance/work-orders/`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.results || [];
        const mappedList = list.map((t: any) => ({
          id: t.id,
          machineCode: t.machine_code,
          machineName: t.machine_name,
          site: t.site,
          priority: t.priority,
          assignedTime: t.assigned_time,
          eta: t.eta,
          assignedBy: t.assigned_by,
          problem: t.problem,
          status: mapStatusToFrontend(t.status),
          temp: t.temp,
          oilPressure: t.oil_pressure,
          vibration: t.vibration,
          hours: t.hours,
          rul: t.rul,
          failurePrediction: t.failure_prediction,
          failureProbability: t.failure_probability,
          requiredParts: t.required_parts,
          instructions: t.instructions,
          engineerNotes: t.engineer_notes,
          images: t.images,
          aiRecommendations: t.ai_recommendations,
          healthBefore: t.health_before,
          lastServiceDate: t.last_service_date,
          timeGenerated: t.time_generated,
          inspectionStatus: t.inspection_status,
          serviceEngineer: t.service_engineer,
          completionTime: t.completion_time,
          statusHistory: t.status_history || [],
          partsReplaced: t.parts_replaced,
          repairCost: t.repair_cost,
          timeTaken: t.time_taken,
          healthAfter: t.health_after,
        }));
        setSharedTasks(mappedList);
      }
    } catch (err) {
      console.warn("Backend offline or connection failed during task fetch.");
    }
  };

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);
  const [completedHistory, setCompletedHistory] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);

  // Filter shared tasks based on role and site
  const filteredSharedTasks = useMemo(() => {
    if (!user) return [];
    const roleName = user.role?.name;
    const site = user.assigned_site;
    if (roleName === "Super Admin" || !site) return sharedTasks;
    return sharedTasks.filter(t => t.site === site);
  }, [sharedTasks, user]);

  const filteredCompletedHistory = useMemo(() => {
    if (!user) return [];
    const roleName = user.role?.name;
    const site = user.assigned_site;
    if (roleName === "Super Admin" || !site) return completedHistory;
    return completedHistory.filter(h => h.site === site);
  }, [completedHistory, user]);

  // Form states
  const [formValues, setFormValues] = useState({
    assetName: "",
    model: "797F",
    serialNumber: "",
    site: "PSG CAS",
    alertThreshold: 75,
    criticalMode: false
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Telemetry streams are handled dynamically in the MachineDetails diagnostics tab.

  // Dark Mode toggling effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedColor(hex);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formValues.assetName.trim()) {
      errors.assetName = "Asset name is required";
    }
    if (!formValues.serialNumber.trim()) {
      errors.serialNumber = "Serial number is required";
    } else if (!formValues.serialNumber.startsWith("CAT-")) {
      errors.serialNumber = "Serial must start with 'CAT-' prefix";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setRegisterSuccess(false);
    } else {
      setFormErrors({});
      setRegisterSuccess(true);
      setTimeout(() => setRegisterSuccess(false), 3000);
    }
  };



  // Colors list
  const catColors = [
    { name: "CAT trademark Yellow", hex: "#FFCD00", desc: "Primary brand identifier, core alerts & highlights" },
    { name: "Industrial Dark Black", hex: "#0D0D0D", desc: "Main app background, heavy text elements" },
    { name: "Deep Charcoal Grey", hex: "#1C1C1E", desc: "Sidebar and card background (elevated context)" },
    { name: "Steel Grey Borders", hex: "#2C2C2E", desc: "Utility dividing lines, grid dividers, input borders" },
    { name: "Operational Green", hex: "#10B981", desc: "Normal healthy machine thresholds indicator" },
    { name: "Action Warning Orange", hex: "#F59E0B", desc: "Active moderate degradation warning indicator" },
    { name: "Action Critical Red", hex: "#EF4444", desc: "Immediate asset shutdown risk alarm indicator" }
  ];

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-stone-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="bg-[#FFCD00] text-black font-extrabold px-6 py-3 rounded text-3xl tracking-tighter shadow-md w-fit mx-auto animate-pulse">
            CAT
          </div>
          <p className="text-xs text-stone-400 font-bold uppercase tracking-wider">Restoring Platform Session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col font-sans select-text bg-background text-foreground">
      {/* 1. Brand Top Warning Strip */}
      <div className="h-2 bg-repeating-linear bg-[linear-gradient(45deg,#FFCD00_25%,#000000_25%,#000000_50%,#FFCD00_50%,#FFCD00_75%,#000000_75%,#000000)] bg-[length:24px_24px] border-b border-black/10" />

      {/* Main Panel Layout */}
      <div className="flex flex-1 flex-col md:flex-row md:h-[calc(100vh-0.5rem)] md:overflow-hidden">
        
        {/* 2. Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={userRole}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onLogout={logout}
        />

        {/* 3. Main content body */}
        <main className="flex-1 flex flex-col p-6 md:p-8 overflow-y-auto max-w-7xl">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <Navbar
              title={activeTab === "dashboard" ? "Fleet Control Hub" : activeTab === "design-system" ? "Component UI Design System" : `${activeTab} Workspace`}
              location={user?.assigned_site || "Global Operations"}
            />
          </div>

          {/* TAB 1: OPERATIONAL DASHBOARD */}
          {activeTab === "dashboard" && (
            userRole === "Super Admin" ? (
              <SuperAdminDashboard onTriggerMessage={handleTriggerMessageToManager} />
            ) : (
              <SitesWorkspace onTriggerMessage={handleTriggerMessageToManager} />
            )
          )}

          {/* TAB 2: DESIGN SYSTEM SHOWCASE */}
          {activeTab === "design-system" && (
            <div className="space-y-8">
              
              {/* Theme description */}
              <Card className="p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-2">Design Theme Overview</h3>
                <p className="text-xs text-stone-500 leading-5">
                  The Caterpillar CAT® UI design system is engineered for industrial environments requiring high reliability, visual hierarchy, and high contrast. Built around black, trademark yellow, dark charcoal, and white, the style combines aggressive borders with modern micro-animations to create a premium, clean, high-performance dashboard layout.
                </p>
              </Card>

              {/* Color Palette visualization */}
              <div className="space-y-4">
                <h3 className="text-md font-extrabold uppercase tracking-wide">Color Palette (Click Hex to Copy)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {catColors.map((color) => (
                    <Card
                      key={color.hex}
                      onClick={() => copyToClipboard(color.hex)}
                      className="p-4 flex flex-col justify-between hover:border-[#FFCD00] cursor-pointer transition-all active:scale-[0.98] select-text group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-8 h-8 rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: color.hex }} />
                        
                        {/* Copied notification check */}
                        {copiedColor === color.hex ? (
                          <Badge variant="success" className="normal-case">
                            Copied
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-stone-400 group-hover:text-[#FFCD00] transition-colors font-mono uppercase">Copy</span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold">{color.name}</h4>
                        <span className="font-mono text-[10px] text-stone-500 block mt-1">{color.hex}</span>
                        <p className="text-[10px] text-stone-400 mt-2 leading-4">{color.desc}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Typography hierarchy scale */}
              <div className="space-y-4">
                <h3 className="text-md font-extrabold uppercase tracking-wide">Typography Hierarchy</h3>
                <Card className="p-6 divide-y divide-stone-200 dark:divide-stone-800">
                  <div className="py-4 first:pt-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                    <span className="text-[10px] font-mono text-stone-400 w-32 shrink-0">H1 Header Bold</span>
                    <h1 className="text-3xl font-extrabold tracking-tight">Caterpillar Operational Hub</h1>
                  </div>
                  <div className="py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                    <span className="text-[10px] font-mono text-stone-400 w-32 shrink-0">H2 Header Bold</span>
                    <h2 className="text-2xl font-bold tracking-tight">Active Machinery Telemetry</h2>
                  </div>
                  <div className="py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                    <span className="text-[10px] font-mono text-stone-400 w-32 shrink-0">H3 Section Title</span>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#FFCD00]">Bearing Vibration Analysis</h3>
                  </div>
                  <div className="py-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                    <span className="text-[10px] font-mono text-stone-400 w-32 shrink-0">Body Text</span>
                    <p className="text-sm text-stone-600 dark:text-stone-400 leading-6 max-w-xl">
                      Telemetry logs are polled continuously at 1Hz frequency from 100+ Caterpillar industrial excavators and utility dump trucks connected to a Neon PostgreSQL instance.
                    </p>
                  </div>
                  <div className="py-4 last:pb-0 flex flex-col sm:flex-row sm:items-baseline justify-between gap-4">
                    <span className="text-[10px] font-mono text-stone-400 w-32 shrink-0">Utility Code/Mono</span>
                    <code className="text-xs font-mono text-[#FFCD00] bg-stone-100 dark:bg-stone-950 px-2 py-0.5 rounded border border-stone-200/50 dark:border-stone-800 w-fit">
                      GET /api/predict/health/f03c-e797-4af6
                    </code>
                  </div>
                </Card>
              </div>

              {/* Button Showcase */}
              <div className="space-y-4">
                <h3 className="text-md font-extrabold uppercase tracking-wide">Interface Action Buttons</h3>
                <Card className="p-6 flex flex-wrap gap-4">
                  <Button variant="primary">Primary Yellow Action</Button>
                  <Button variant="secondary">Secondary Charcoal</Button>
                  <Button variant="outline">Outline Bordered</Button>
                  <Button variant="danger">Destructive Action</Button>
                  <Button variant="ghost">Ghost Button</Button>
                </Card>
              </div>

            </div>
          )}

          {/* TAB 3: MACHINE DETAILS WORKSPACE */}
          {activeTab === "machines" && (
            <MachineDetails />
          )}

          {/* TAB 4: REPORTS WORKSPACE */}
          {activeTab === "reports" && (
            <ReportsModule />
          )}

          {/* SITES WORKSPACE */}
          {activeTab === "sites" && (
            <SitesWorkspace onTriggerMessage={handleTriggerMessageToManager} />
          )}

          {/* TAB: MESSAGES WORKSPACE */}
          {activeTab === "messages" && (
            <MessagesWorkspace
              prefilledManagerId={messagesPrefill?.managerId}
              prefilledMessageContext={messagesPrefill?.context}
              prefilledMessageBody={messagesPrefill?.body}
              onClearPrefill={() => setMessagesPrefill(null)}
            />
          )}

          {/* MAINTENANCE COMMAND CENTER */}
          {activeTab === "maintenance" && (
            <MaintenanceCommandCenter
              tasks={filteredSharedTasks}
              setTasks={setSharedTasks}
              completedHistory={filteredCompletedHistory}
              setCompletedHistory={setCompletedHistory}
              timeline={timeline}
              setTimeline={setTimeline}
              refreshTasks={fetchTasks}
            />
          )}

          {/* SERVICE OPERATIONS */}
          {activeTab === "service" && (
            <ServiceOperations
              tasks={filteredSharedTasks}
              setTasks={setSharedTasks}
              completedHistory={filteredCompletedHistory}
              setCompletedHistory={setCompletedHistory}
              timeline={timeline}
              setTimeline={setTimeline}
              refreshTasks={fetchTasks}
            />
          )}

          {/* TAB: PROFILE WORKSPACE */}
          {activeTab === "profile" && (
            <Card className="max-w-2xl mx-auto p-6 border border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden relative">
              <div className="h-1.5 bg-[#FFCD00] -mx-6 -mt-6 mb-6" />
              <div className="space-y-6">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#FFCD00]">User Account Info</span>
                  <h3 className="text-xl font-extrabold text-stone-900 dark:text-stone-50">Caterpillar Profile Workspace</h3>
                  <p className="text-xs text-stone-500 mt-1">Review credentials and assigned facility clearance authorization keys.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-stone-950 rounded border border-stone-850 space-y-2 col-span-1 md:col-span-2">
                    <span className="text-[8px] text-stone-500 uppercase block font-bold">Full Name</span>
                    {isEditingName ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            disabled={nameUpdateSaving}
                            className="bg-stone-900 border border-stone-800 rounded px-2 py-1 text-stone-100 text-sm font-extrabold flex-1 focus:outline-none focus:border-[#FFCD00]"
                          />
                          <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={nameUpdateSaving}
                            className="bg-[#FFCD00] hover:bg-[#E5B800] text-black font-extrabold text-[10px] px-3 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            {nameUpdateSaving ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingName(false);
                              setNewName(user?.name || "");
                              setNameUpdateError(null);
                            }}
                            disabled={nameUpdateSaving}
                            className="bg-stone-800 hover:bg-stone-700 text-stone-300 font-extrabold text-[10px] px-3 py-1 rounded transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                        {nameUpdateError && (
                          <span className="text-[10px] text-red-500 font-bold block">{nameUpdateError}</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-stone-200 font-extrabold text-sm block">{user?.name || "N/A"}</span>
                        <button
                          type="button"
                          onClick={() => setIsEditingName(true)}
                          className="text-[#FFCD00] hover:underline text-[10px] font-extrabold block"
                        >
                          Edit Name
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-stone-950 rounded border border-stone-850 space-y-1.5">
                    <span className="text-[8px] text-stone-500 uppercase block font-bold">Email Address</span>
                    <span className="text-stone-200 font-extrabold text-sm block">{user?.email || "N/A"}</span>
                  </div>
                  <div className="p-4 bg-stone-950 rounded border border-stone-850 space-y-1.5">
                    <span className="text-[8px] text-stone-550 uppercase block font-bold">Assigned Site Location</span>
                    <span className="text-stone-200 font-extrabold text-sm block">{user?.assigned_site || "GLOBAL FLEET"}</span>
                  </div>
                  <div className="p-4 bg-stone-950 rounded border border-stone-850 space-y-1.5">
                    <span className="text-[8px] text-stone-550 uppercase block font-bold">Platform Role</span>
                    <span className="text-[#FFCD00] font-extrabold text-sm block uppercase tracking-wider">{user?.role?.name || "N/A"}</span>
                  </div>
                </div>

                <div className="border-t border-stone-850 pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[10px] text-stone-500 font-mono">
                  <span>Last Login Session: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  <button
                    type="button"
                    onClick={logout}
                    className="bg-red-600 hover:bg-red-500 text-white font-bold uppercase text-[10px] px-4 py-2 rounded transition-colors"
                  >
                    Logout Session
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* CATCH-ALL FOR MOCK TABS */}
          {activeTab !== "dashboard" && activeTab !== "design-system" && activeTab !== "machines" && activeTab !== "reports" && activeTab !== "sites" && activeTab !== "maintenance" && activeTab !== "service" && activeTab !== "profile" && activeTab !== "messages" && (
            <div className="space-y-6">
              <Card className="p-6 border border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-[#FFCD00]/10 text-[#FFCD00] rounded-full">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold uppercase tracking-wider">{activeTab} View Context</h3>
                    <p className="text-xs text-stone-500">Restricted role context verification panel</p>
                  </div>
                </div>

                <p className="text-sm text-stone-600 dark:text-stone-400 leading-6 mb-6">
                  You are viewing the <strong className="text-stone-800 dark:text-stone-200 uppercase">{activeTab}</strong> page. In a live production deploy, this interface queries the corresponding Django REST endpoints (e.g. <code className="text-xs font-mono text-[#FFCD00] bg-stone-200 dark:bg-stone-950 px-1.5 py-0.5 rounded">/api/{activeTab}/</code>) using the JWT token stored under local storage.
                </p>

                <div className="p-4 bg-stone-50 dark:bg-stone-950 rounded border border-stone-300 dark:border-stone-800 space-y-3">
                  <span className="text-xs font-bold block uppercase tracking-wider text-stone-500">Active Access Tokens Profile</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-2 bg-stone-100 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-800 overflow-x-auto">
                      <span className="font-bold text-stone-500 block mb-1">User Role Level:</span>
                      <span className="text-[#FFCD00] font-bold">{userRole}</span>
                    </div>
                    <div className="p-2 bg-stone-100 dark:bg-stone-900 rounded border border-stone-200 dark:border-stone-800 overflow-x-auto">
                      <span className="font-bold text-stone-500 block mb-1">Access Scope Auth:</span>
                      <span className="text-emerald-500 font-bold">Authorized Access Level</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <Button variant="secondary" onClick={() => setActiveTab("dashboard")}>
                    Return to Operational Dashboard
                  </Button>
                </div>
              </Card>
            </div>
          )}

        </main>
      </div>

      {/* 4. Brand Bottom Copyright Strip */}
      <footer className="bg-stone-900 border-t border-stone-800 py-3.5 px-6 text-center text-[10px] text-stone-500 font-bold tracking-widest uppercase">
        © 2026 CATERPILLAR INC. ALL RIGHTS RESERVED. TRADEMARK OF CATERPILLAR CO.
      </footer>
    </div>
  );
}
