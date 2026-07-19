import { API_URL, WS_URL, AI_SERVICE_URL } from "@/config/env";
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chart } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

interface MachineProfile {
  id: string;
  name: string;
  model: string;
  serial_number: string;
  status: string;
  created_at: string;
}

interface HealthRecommendation {
  action: string;
  priority: string;
  description: string;
}

interface HealthData {
  machine_id: string;
  machine_name: string;
  health_score: number;
  failure_probability: number;
  remaining_useful_life_hours: number;
  is_anomaly: boolean;
  anomaly_score: number;
  predicted_failure_mode: string;
  recommendations: HealthRecommendation[];
  telemetry_evaluations?: Record<string, any>;
  evaluated_at: string;
}

export const MachineDetails: React.FC = () => {
  const [machines, setMachines] = useState<MachineProfile[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [historyPoints, setHistoryPoints] = useState<Array<{ time: number; value: number }>>([]);
  const [equipments, setEquipments] = useState<any[]>([]);

  const [telemetry, setTelemetry] = useState({
    temp: 68.0,
    rpm: 1500,
    engineLoad: 60,
    oilPressure: 40.0,
    hydraulicPressure: 45.0,
    batteryVoltage: 13.0,
    fuelLevel: 80.0,
    coolantTemp: 72.0,
    humidity: 45,
    vibeX: 0.9,
    vibeY: 1.1,
    vibeZ: 1.2
  });

  // Color text helper for live telemetry numeric reading values (No badges/pills)
  const getTelemetryTextColor = (name: string, val: number) => {
    if (val === undefined || val === null) return "text-emerald-500";
    if (name === "Coolant_Temperature") {
      if (val > 106) return "text-red-600 font-extrabold";
      if (val > 98) return "text-amber-600 font-extrabold";
      if (val > 90) return "text-yellow-500 font-bold";
      return "text-emerald-500 font-bold";
    }
    if (name === "Engine_Oil_Pressure") {
      if (val < 20) return "text-red-600 font-extrabold";
      if (val < 28) return "text-amber-600 font-extrabold";
      if (val < 35) return "text-yellow-500 font-bold";
      return "text-emerald-500 font-bold";
    }
    if (name === "Engine_RPM") {
      if (val > 2350) return "text-red-600 font-extrabold";
      if (val > 2200) return "text-amber-600 font-extrabold";
      if (val > 2000) return "text-yellow-500 font-bold";
      return "text-emerald-500 font-bold";
    }
    if (name === "Hydraulic_Pressure") {
      if (val > 4400) return "text-red-600 font-extrabold";
      if (val > 3800) return "text-amber-600 font-extrabold";
      if (val > 3200) return "text-yellow-500 font-bold";
      return "text-emerald-500 font-bold";
    }
    if (name === "Vibration") {
      if (val > 10.5) return "text-red-600 font-extrabold";
      if (val > 7.5) return "text-amber-600 font-extrabold";
      if (val > 4.5) return "text-yellow-500 font-bold";
      return "text-emerald-500 font-bold";
    }
    return "text-emerald-500 font-bold";
  };

  // Fetch machines list on mount
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const res = await fetch(`${API_URL}/api/machinery/machines/`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.results || [];
          setMachines(list);
          if (list.length > 0) {
            setSelectedMachineId(list[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch machines:", err);
      }
    };
    fetchMachines();
  }, []);

  const currentMachine = machines.find((m) => m.id === selectedMachineId);

  // Fetch ML health prediction metrics
  const fetchHealthMetrics = async (machineId: string) => {
    if (!machineId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${AI_SERVICE_URL}/api/predict/health/${machineId}`);
      if (res.ok) {
        const data = await res.json();
        setHealthData(data);
      }
    } catch (err) {
      console.error("Failed to fetch ML health prediction:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMachineSubsystems = async (machineId: string) => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/api/machinery/machines/${machineId}/`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.equipments) {
          setEquipments(data.equipments);
        }
      }
    } catch (err) {
      console.error("Failed to fetch machine subsystems:", err);
    }
  };

  useEffect(() => {
    if (selectedMachineId) {
      fetchHealthMetrics(selectedMachineId);
      fetchMachineSubsystems(selectedMachineId);
    }
  }, [selectedMachineId]);

  // Live WebSocket telemetry subscription
  useEffect(() => {
    if (!selectedMachineId) return;

    let ws: WebSocket | null = null;
    let tickCount = 0;

    const connectWebSocket = () => {
      try {
        const wsUrl = WS_URL.startsWith("ws") ? `${WS_URL}/ws/telemetry/` : `ws://${WS_URL}/ws/telemetry/`;
        
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
          ws?.send(JSON.stringify({ action: "subscribe", machine_id: selectedMachineId }));
        };

        ws.onmessage = (event) => {
          try {
            const data = json_parse(event.data);
            if (data.type === "telemetry_update") {
              setTelemetry(data.telemetry);
              if (data.equipments) {
                setEquipments(data.equipments);
              }
              tickCount++;
              setHistoryPoints((prev) => {
                const next = [...prev, { time: tickCount, value: data.telemetry.vibeZ }];
                return next.slice(-20);
              });
            }
          } catch (e) {
            // Parsing error
          }
        };

        ws.onerror = () => {
          setWsConnected(false);
        };

        ws.onclose = () => {
          setWsConnected(false);
        };
      } catch (err) {
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [selectedMachineId]);

  const json_parse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return {};
    }
  };

  // Derived failure state metrics from ML data
  const healthScore = healthData ? healthData.health_score : 100.0;
  const rulHours = healthData ? healthData.remaining_useful_life_hours : 2000.0;
  const failureProbability = healthData ? `${(healthData.failure_probability * 100).toFixed(0)}%` : "0%";

  const faultIntelligenceCards = React.useMemo(() => {
    if (!healthData || !healthData.telemetry_evaluations) return [];
    const cards: Array<{
      reading: string;
      value: number;
      unit: string;
      status: string;
      title: string;
      desc: string;
      reason: string;
      action: string;
    }> = [];

    Object.entries(healthData.telemetry_evaluations).forEach(([rName, ev]: [string, any]) => {
      if (ev && ev.status && ev.status !== "safe") {
        cards.push({
          reading: rName.replace(/_/g, " "),
          value: ev.value,
          unit: ev.unit || "",
          status: ev.status.toUpperCase(),
          title: ev.fault_title || "Telemetry Threshold Alert",
          desc: ev.fault_description || "Sensor value exceeded normal operating boundaries.",
          reason: ev.reason || "Component strain under load",
          action: ev.action || "Inspect Subsystem"
        });
      }
    });

    return cards;
  }, [healthData]);

  const aiRecommendations = healthData && healthData.recommendations
    ? healthData.recommendations.map((rec) => ({
        priority: rec.priority.toUpperCase(),
        text: `${rec.action} - ${rec.description}`
      }))
    : [{ priority: "NOMINAL", text: "All sensor telemetry remains within safe historical operating limits." }];

  const timelineEvents = healthData && healthData.is_anomaly
    ? [
        { label: "Anomaly Flagged", time: "Just evaluated", text: `AI engine flagged sensor drift on Z-axis (score: ${healthData.anomaly_score})` }
      ]
    : [
        { label: "Safe Operation", time: "Evaluated now", text: "Telemetry metrics within nominal bounds" }
      ];

  const maintenanceHistory = [
    { date: "2026-05-12", task: "Hydraulic pump assembly replace", tech: "John Doe", cost: "$4,250", status: "completed" },
    { date: "2026-03-04", task: "Engine oil and filters replacement", tech: "Alex Smith", cost: "$680", status: "completed" }
  ];

  const serviceHistory = [
    { date: "2026-06-20", task: "Alternator inspection & voltage check", tech: "Elena Rostova", result: "Nominal 12.8V output verified" },
    { date: "2026-04-18", task: "Vibration sensor calibration check", tech: "Mark Vance", result: "Transducer cleaned and realigned" }
  ];

  const handleDownload = () => {
    if (!currentMachine) return;
    setReportDownloading(true);
    setTimeout(() => {
      const dataStr = `CATERPILLAR PREDICTIVE MAINTENANCE REPORT
Generated: ${new Date().toISOString()}
Asset: ${currentMachine.name}
Serial: ${currentMachine.serial_number}
Model: ${currentMachine.model}
Status: ${currentMachine.status.toUpperCase()}

METRICS SUMMARY:
Health Score: ${healthScore}%
Remaining Useful Life (RUL): ${rulHours} hours
Active Subsystem Status: ${healthData ? healthData.predicted_failure_mode : "Normal Operation"}

LATEST TELEMETRY SENSORS:
Temperature: ${telemetry.temp} C
Coolant Temp: ${telemetry.coolantTemp} C
Engine RPM: ${telemetry.rpm}
Load Level: ${telemetry.engineLoad}%
Oil Pressure: ${telemetry.oilPressure} psi
Hydraulic Pressure: ${telemetry.hydraulicPressure} psi
Battery Voltage: ${telemetry.batteryVoltage} V
Vibration (Z-Axis): ${telemetry.vibeZ} mm/s`;

      const blob = new Blob([dataStr], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${currentMachine.serial_number}-inspection-report.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setReportDownloading(false);
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Selector & Top Download Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFFBEB]/50 dark:bg-stone-950/20 p-4 border border-stone-200 dark:border-stone-800 rounded">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Select Machinery:</span>
          <select
            value={selectedMachineId}
            onChange={(e) => {
              setSelectedMachineId(e.target.value);
              setHistoryPoints([]);
            }}
            className="bg-stone-100 text-stone-700 text-xs font-bold border border-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:border-stone-700 py-1.5 px-3 rounded focus:outline-none focus:border-[#FFCD00] cursor-pointer"
          >
            {machines.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <Button
          onClick={handleDownload}
          disabled={reportDownloading || !currentMachine}
          variant="primary"
          className="flex items-center gap-2 text-xs font-bold py-1.5"
        >
          {reportDownloading ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5 text-black" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Compiling Data...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Inspection Report
            </>
          )}
        </Button>
      </div>

      {currentMachine ? (
        <>
          {/* Info & Health Score Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Machine Information */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Asset Properties</span>
                <h3 className="text-md font-bold text-stone-900 dark:text-stone-50 mt-1">{currentMachine.name}</h3>
                <p className="text-xs text-[#FFCD00] font-bold uppercase mt-0.5">{currentMachine.model}</p>
              </div>
              <div className="space-y-2 mt-4 pt-4 border-t border-stone-200 dark:border-stone-800 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Serial Tag:</span>
                  <span className="font-mono font-bold">{currentMachine.serial_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Facility Status:</span>
                  <span className="font-bold capitalize">{currentMachine.status}</span>
                </div>
              </div>
            </Card>

            {/* Health Score Gauge */}
            <Card className="p-5 flex flex-col justify-between items-center text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Machine Health Index</span>
                <div className="relative mt-4 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-4 border-stone-800 flex items-center justify-center relative">
                    <span className={`text-2xl font-extrabold ${healthScore > 80 ? "text-emerald-500" : healthScore > 50 ? "text-amber-500" : "text-red-500"}`}>
                      {healthScore}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <Badge variant={healthScore > 80 ? "success" : healthScore > 50 ? "warning" : "danger"}>
                  {healthScore > 80 ? "Nominal Operations" : healthScore > 50 ? "Degradation Warning" : "Critical Shutdown Alert"}
                </Badge>
              </div>
            </Card>

            {/* Remaining Useful Life */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Remaining Useful Life (RUL)</span>
                <div className="mt-3">
                  <span className={`text-4xl font-extrabold tracking-tight ${rulHours < 300 ? "text-red-500" : "text-cyan-500"}`}>
                    {rulHours} hrs
                  </span>
                  <span className="text-xs text-stone-500 block mt-1">Estimated operating hours before expected overhaul</span>
                </div>
              </div>
              <div className="pt-3 mt-4 border-t border-stone-200 dark:border-stone-800 flex justify-between text-xs">
                <span className="text-stone-500">Failure Probability:</span>
                <span className="font-bold text-red-500">{failureProbability}</span>
              </div>
            </Card>

          </div>

          {/* Equipment & Subsystem Health Dashboard */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-[#FFCD00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-stone-900 dark:text-stone-50">Subsystem Health Center</h3>
            </div>
            
            {equipments.length === 0 ? (
              <Card className="p-6 text-center text-stone-500 text-xs font-bold bg-stone-50/50 dark:bg-stone-950/20">
                Loading Subsystem Telemetry...
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {equipments.map((eq) => {
                  const subHealth = eq.health_score;
                  const failureProb = eq.failure_probability;
                  const sensors = eq.sensor_readings || {};
                  const subRul = Math.max(0, Math.round(2000.0 * ((subHealth / 100.0) ** 2)));

                  return (
                    <Card key={eq.id} className="p-5 border-stone-200 dark:border-stone-800 hover:border-[#FFCD00] transition-all duration-150 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-stone-250 dark:border-stone-850 pb-3">
                          <span className="font-extrabold text-stone-900 dark:text-stone-100 uppercase tracking-wide text-xs">{eq.name.replace(/_/g, " ")}</span>
                          <Badge variant={eq.status === "operational" ? "success" : eq.status === "warning" ? "warning" : "danger"}>
                            {eq.status.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="my-4 flex items-center justify-between">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-stone-500 block">Health Index</span>
                            <span className={`text-xl font-extrabold block mt-0.5 ${subHealth >= 90 ? "text-emerald-500" : subHealth >= 75 ? "text-amber-500" : "text-red-500"}`}>
                              {subHealth.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] uppercase font-bold text-stone-500 block">Subsystem RUL</span>
                            <span className="text-sm font-extrabold text-stone-850 dark:text-stone-200 block mt-0.5">{subRul} hrs</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] mb-4 bg-stone-100/50 dark:bg-stone-900/40 p-2.5 rounded border border-stone-200 dark:border-stone-800">
                          <div>
                            <span className="text-stone-400 font-bold uppercase">Anomaly Probability:</span>
                            <span className="font-mono font-extrabold text-red-500 block mt-0.5">{(failureProb * 100).toFixed(0)}%</span>
                          </div>
                          <div>
                            <span className="text-stone-400 font-bold uppercase">Predicted Failure:</span>
                            <span className="font-extrabold block mt-0.5 text-stone-700 dark:text-stone-300">
                              {subHealth < 75 ? `${eq.name.toUpperCase()} FAULT` : "NOMINAL"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <span className="text-[9px] uppercase font-bold text-stone-400 block tracking-wider">Subsystem Readings</span>
                          {Object.entries(sensors).map(([key, val]: any) => (
                            <div key={key} className="flex justify-between items-center text-xs pb-1 border-b border-stone-200/50 dark:border-stone-800/40 last:border-0 last:pb-0">
                              <span className="text-stone-500">{key.replace(/_/g, " ")}:</span>
                              <span className="font-mono font-bold text-stone-850 dark:text-stone-100">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Sensors Grid & Graph */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live Sensors telemetry display */}
            <Card className="p-5 lg:col-span-2">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${wsConnected ? "bg-emerald-500 animate-ping" : "bg-[#FFCD00] animate-ping"}`} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Live Telemetry Metrics (1Hz Frequency)</h3>
                </div>
                <Badge variant={wsConnected ? "success" : "warning"} className="normal-case font-bold text-[9px] px-1.5 py-0">
                  {wsConnected ? "WS: Connected" : "WS: Simulated Fallback"}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <div key={idx} className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-300 dark:border-stone-800 space-y-2.5">
                      <Skeleton className="h-2 w-1/2" />
                      <Skeleton className="h-4 w-3/4 mt-1" />
                    </div>
                  ))
                ) : (
                  <>
                    <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800">
                      <span className="text-[9px] uppercase font-bold text-stone-500">Core Temp</span>
                      <div className={`text-sm mt-1 ${getTelemetryTextColor("Coolant_Temperature", telemetry.coolantTemp)}`}>{telemetry.coolantTemp} °C</div>
                    </div>
                    <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800">
                      <span className="text-[9px] uppercase font-bold text-stone-500">Engine Speed</span>
                      <div className={`text-sm mt-1 ${getTelemetryTextColor("Engine_RPM", telemetry.rpm)}`}>{telemetry.rpm} RPM</div>
                    </div>
                    <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800">
                      <span className="text-[9px] uppercase font-bold text-stone-500">Engine Load</span>
                      <div className={`text-sm mt-1 ${getTelemetryTextColor("Engine_Load", telemetry.engineLoad)}`}>{telemetry.engineLoad} %</div>
                    </div>
                    <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800">
                      <span className="text-[9px] uppercase font-bold text-stone-500">Oil Pressure</span>
                      <div className={`text-sm mt-1 ${getTelemetryTextColor("Engine_Oil_Pressure", telemetry.oilPressure)}`}>{telemetry.oilPressure} psi</div>
                    </div>
                    <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800">
                      <span className="text-[9px] uppercase font-bold text-stone-500">Hydraulic PSI</span>
                      <div className={`text-sm mt-1 ${getTelemetryTextColor("Hydraulic_Pressure", telemetry.hydraulicPressure)}`}>{telemetry.hydraulicPressure} psi</div>
                    </div>
                    <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800">
                      <span className="text-[9px] uppercase font-bold text-stone-500">Battery Volt</span>
                      <div className="text-sm font-bold text-emerald-500 mt-1">{telemetry.batteryVoltage} V</div>
                    </div>
                    <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800">
                      <span className="text-[9px] uppercase font-bold text-stone-500">Fuel Level</span>
                      <div className="text-sm font-bold text-emerald-500 mt-1">{telemetry.fuelLevel} %</div>
                    </div>
                    <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-200 dark:border-stone-800">
                      <span className="text-[9px] uppercase font-bold text-stone-500">Vibration Z</span>
                      <div className={`text-sm mt-1 ${getTelemetryTextColor("Vibration", telemetry.vibeZ)}`}>{telemetry.vibeZ} mm/s</div>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Live Scrolling Waveform Chart */}
            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2">Z-Axis Vibration Waveform</h3>
              <p className="text-xs text-stone-500 mb-4">Scrolling window tracking vibration magnitude</p>
              <div className="pt-2">
                {isLoading ? (
                  <Skeleton className="h-[100px] w-full" />
                ) : (
                  <Chart data={historyPoints} maxScale={6} strokeColor="#FFCD00" height={100} />
                )}
              </div>
            </Card>

          </div>

          {/* AI Recommendation & Predictions Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* AI Recommendations & Telemetry Threshold Fault Intelligence */}
            <Card className="p-5 lg:col-span-2">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4">FastAPI AI Maintenance Prescription & Fault Intelligence</h3>
              <div className="space-y-3">
                {faultIntelligenceCards.length > 0 ? (
                  faultIntelligenceCards.map((card, i) => (
                    <div key={i} className="p-4 bg-stone-50 dark:bg-stone-950/65 rounded border border-amber-500/30 dark:border-amber-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100">{card.title}</span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${card.status === "FAILURE" ? "bg-red-500/10 text-red-500" : card.status === "CRITICAL" ? "bg-amber-500/10 text-amber-500" : "bg-yellow-500/10 text-yellow-500"}`}>
                          {card.status}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-300">{card.desc}</p>
                      <div className="text-[11px] text-stone-500 space-y-1 pt-1 border-t border-stone-200 dark:border-stone-800">
                        <div><strong className="text-stone-400">Root Cause:</strong> {card.reason}</div>
                        <div><strong className="text-[#FFCD00]">Recommended Action:</strong> {card.action}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  aiRecommendations.map((rec, i) => (
                    <div key={i} className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-300 dark:border-stone-800 flex items-start gap-3">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase">{rec.priority}</span>
                      <p className="text-xs text-stone-700 dark:text-stone-300 leading-5">{rec.text}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Prediction Timeline */}
            <Card className="p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-4">Anomaly Timeline Events</h3>
              <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-800">
                {timelineEvents.map((ev, i) => (
                  <div key={i} className="pl-6 relative">
                    <span className="absolute left-[3px] top-[5px] w-2.5 h-2.5 rounded-full bg-[#FFCD00] border border-stone-900" />
                    <span className="text-[10px] text-stone-500 font-mono block">{ev.time}</span>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block mt-0.5">{ev.label}</span>
                    <p className="text-[11px] text-stone-500 leading-4 mt-0.5">{ev.text}</p>
                  </div>
                ))}
              </div>
            </Card>

          </div>

          {/* Maintenance & Service History */}
          <Card>
            <CardHeader className="py-4 border-b border-stone-200 dark:border-stone-800">
              <CardTitle>Historical Log & Calibration Registers</CardTitle>
              <CardDescription>Comprehensive ledger of past maintenance repairs and electrical validations</CardDescription>
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200 dark:divide-stone-800">
              
              {/* Left Column: Maintenance History */}
              <div className="p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Repair & Overhaul Records</h4>
                <div className="space-y-3">
                  {maintenanceHistory.map((m, i) => (
                    <div key={i} className="text-xs pb-3 last:pb-0 border-b last:border-0 border-stone-200 dark:border-stone-800 flex justify-between">
                      <div>
                        <span className="font-bold text-stone-900 dark:text-stone-100">{m.task}</span>
                        <span className="text-[10px] text-stone-500 block mt-1 font-mono">Date: {m.date} | Tech: {m.tech}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold block">{m.cost}</span>
                        <span className="text-[10px] text-emerald-500 font-bold uppercase block mt-1">{m.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Service/Calibration Records */}
              <div className="p-5 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">Calibration & Inspection Audits</h4>
                <div className="space-y-3">
                  {serviceHistory.map((s, i) => (
                    <div key={i} className="text-xs pb-3 last:pb-0 border-b last:border-0 border-stone-200 dark:border-stone-800">
                      <div className="flex justify-between font-bold">
                        <span className="text-stone-900 dark:text-stone-100">{s.task}</span>
                        <span className="text-[10px] text-stone-500 font-mono">Date: {s.date}</span>
                      </div>
                      <p className="text-[11px] text-stone-500 leading-4 mt-1">Audit result: {s.result}</p>
                      <span className="text-[9px] text-stone-400 mt-1 block">Inspected by: {s.tech}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </Card>
        </>
      ) : (
        <Card className="p-10 text-center text-stone-500 text-xs font-bold">
          No machinery registries found in database.
        </Card>
      )}

    </div>
  );
};
