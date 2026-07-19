import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chart } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

import { API_URL, WS_URL } from "@/config/env";

const SENSOR_THRESHOLDS: Record<string, any> = {
  Coolant_Temperature: { safeMax: 90, warnMax: 98, critMax: 106, unit: "°C", faults: { warn: ["Coolant Temp Warning", "Radiator airflow restricted", "Inspect Cooling System"], crit: ["Engine Thermal Overheat Warning", "Radiator restriction or coolant flow loss", "Inspect Cooling System"], fail: ["Severe Engine Thermal Overload", "Extreme radiator clog or pump failure", "Fix Cooling System Failure"] } },
  Engine_Oil_Pressure: { safeMin: 35, warnMin: 28, critMin: 20, unit: "psi", faults: { warn: ["Oil Pressure Low Warning", "Oil pump wear or viscosity breakdown", "Plan Engine Oil Pump Replacement"], crit: ["Low Engine Oil Pressure Alert", "Oil pump cavitation or seal leakage", "Replace Engine Oil Pump"], fail: ["Critical Oil Pressure Loss", "Severe oil pump failure or major leak", "Emergency Maintenance"] } },
  Engine_RPM: { safeMax: 2000, warnMax: 2200, critMax: 2350, unit: "RPM", faults: { warn: ["Engine Overspeed Warning", "Governor adjustment needed", "Schedule Maintenance"], crit: ["Engine Overspeed Alert", "Throttle control fault", "Schedule Maintenance"], fail: ["Critical Engine Overspeed", "Runaway risk", "Immediate Shutdown"] } },
  Engine_Load: { safeMax: 75, warnMax: 88, critMax: 96, unit: "%", faults: { warn: ["High Engine Load Warning", "High duty cycle operation", "Schedule Maintenance"], crit: ["Critical Engine Load Alert", "Equipment overload", "Schedule Maintenance"], fail: ["Engine Overload Lockout", "Sustained overload operation", "Immediate Shutdown"] } },
  Hydraulic_Pressure: { safeMax: 3200, warnMax: 3800, critMax: 4400, unit: "psi", faults: { warn: ["Hydraulic Pressure High", "Relief valve adjustment needed", "Schedule Maintenance"], crit: ["Hydraulic Overpressure Alert", "Relief valve restricted or pump fault", "Inspect Fuel System"], fail: ["Hydraulic Line Burst Risk", "Main relief valve stuck closed", "Emergency Maintenance"] } },
  Hydraulic_Oil_Temperature: { safeMax: 75, warnMax: 88, critMax: 100, unit: "°C", faults: { warn: ["Hydraulic Oil Warm", "Oil cooler dissipation low", "Schedule Maintenance"], crit: ["Hydraulic Thermal Stress Alert", "Oil cooler bypass fault", "Fix Cooling System Failure"], fail: ["Hydraulic Oil Degradation", "Fluid breakdown risk", "Emergency Maintenance"] } },
  Transmission_Oil_Pressure: { safeMin: 250, warnMin: 200, critMin: 160, unit: "psi", faults: { warn: ["Transmission Pressure Warning", "Clutch charge pump wear", "Schedule Maintenance"], crit: ["Transmission Pressure Drop Alert", "Clutch seal internal leak", "Emergency Maintenance"], fail: ["Transmission Pressure Failure", "Transmission pump failure", "Emergency Maintenance"] } },
  Transmission_Oil_Temperature: { safeMax: 90, warnMax: 108, critMax: 125, unit: "°C", faults: { warn: ["Transmission Oil Temp Warning", "Torque converter slip", "Schedule Maintenance"], crit: ["Transmission Overheating Alert", "Clutch slippage or fluid breakdown", "Emergency Maintenance"], fail: ["Transmission Thermal Breakdown", "Internal clutch failure", "Immediate Shutdown"] } },
  Brake_Temperature: { safeMax: 110, warnMax: 160, critMax: 210, unit: "°C", faults: { warn: ["Brake Temperature Warning", "Heavy retarding operation", "Schedule Maintenance"], crit: ["Brake Overheating Alert", "Brake drag or cooling flow loss", "Emergency Maintenance"], fail: ["Brake Thermal Fade Critical", "Vapor lock risk", "Immediate Shutdown"] } },
  Track_Temperature: { safeMax: 65, warnMax: 80, critMax: 98, unit: "°C", faults: { warn: ["Track Bushing Temp Warning", "Lack of pin lubrication", "Schedule Maintenance"], crit: ["Track Overheating Alert", "Track chain over-tensioning", "Check Track Chain Tension & Links"], fail: ["Track Seizure Risk Critical", "Bushing galling risk", "Immediate Shutdown"] } },
  Axle_Temperature: { safeMax: 70, warnMax: 88, critMax: 105, unit: "°C", faults: { warn: ["Axle Temperature Warning", "Differential oil degradation", "Schedule Maintenance"], crit: ["Axle Overheating Alert", "Planet gear bearing wear", "Inspect Front Axle Bearings & Pins"], fail: ["Axle Bearing Lockout Critical", "Differential bearing breakdown", "Emergency Maintenance"] } },
  Vibration: { safeMax: 4.5, warnMax: 7.5, critMax: 10.5, unit: "mm/s", faults: { warn: ["Vibration Elevated Warning", "Structural dampener wear", "Schedule Maintenance"], crit: ["Harmonic Vibration Alert", "Shaft misalignment or imbalance", "Schedule Maintenance"], fail: ["Critical Mechanical Vibration", "Severe mechanical looseness", "Emergency Maintenance"] } }
};

const float_parse = (v: any) => {
  const parsed = parseFloat(v);
  return isNaN(parsed) ? 0.0 : parsed;
};

const evaluateSensor = (key: string, rawVal: any) => {
  const val = float_parse(rawVal);
  const rule = SENSOR_THRESHOLDS[key];
  if (!rule) return { status: "safe", textColor: "text-emerald-500 font-bold", val, fault: null };

  if (rule.safeMin !== undefined) {
    if (val < rule.critMin) return { status: "failure", textColor: "text-red-600 font-extrabold", val, fault: { title: rule.faults.fail[0], reason: rule.faults.fail[1], action: rule.faults.fail[2] } };
    if (val < rule.warnMin) return { status: "critical", textColor: "text-amber-600 font-extrabold", val, fault: { title: rule.faults.crit[0], reason: rule.faults.crit[1], action: rule.faults.crit[2] } };
    if (val < rule.safeMin) return { status: "warning", textColor: "text-yellow-500 font-bold", val, fault: { title: rule.faults.warn[0], reason: rule.faults.warn[1], action: rule.faults.warn[2] } };
    return { status: "safe", textColor: "text-emerald-500 font-bold", val, fault: null };
  } else {
    if (val > rule.critMax) return { status: "failure", textColor: "text-red-600 font-extrabold", val, fault: { title: rule.faults.fail[0], reason: rule.faults.fail[1], action: rule.faults.fail[2] } };
    if (val > rule.warnMax) return { status: "critical", textColor: "text-amber-600 font-extrabold", val, fault: { title: rule.faults.crit[0], reason: rule.faults.crit[1], action: rule.faults.crit[2] } };
    if (val > rule.safeMax) return { status: "warning", textColor: "text-yellow-500 font-bold", val, fault: { title: rule.faults.warn[0], reason: rule.faults.warn[1], action: rule.faults.warn[2] } };
    return { status: "safe", textColor: "text-emerald-500 font-bold", val, fault: null };
  }
};

interface UnifiedSubsystemMonitorProps {
  machineId: string;
}

export const UnifiedSubsystemMonitor: React.FC<UnifiedSubsystemMonitorProps> = ({ machineId }) => {
  const [wsConnected, setWsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [machineData, setMachineData] = useState<any | null>(null);
  const [equipments, setEquipments] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any>({});
  const [selectedSubsystem, setSelectedSubsystem] = useState<string>("Engine");
  
  // History trackers for charts
  const [healthHistory, setHealthHistory] = useState<Record<string, Array<{ time: number; value: number }>>>({});
  const [sensorHistory, setSensorHistory] = useState<Record<string, Array<{ time: number; value: number }>>>({});
  const [tick, setTick] = useState(0);

  // Fetch initial state of machine with nested equipments
  const fetchInitialState = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      let targetId = machineId;
      if (!targetId) {
        const mRes = await fetch(`${API_URL}/api/machinery/machines/`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (mRes.ok) {
          const mData = await mRes.json();
          const list = Array.isArray(mData) ? mData : mData.results || [];
          if (list.length > 0) targetId = list[0].id;
        }
      }
      if (!targetId) return;
      const res = await fetch(`${API_URL}/api/machinery/machines/${targetId}/`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMachineData(data);
        if (data.equipments) {
          setEquipments(data.equipments);
          if (data.equipments.length > 0) {
            setSelectedSubsystem(data.equipments[0].name);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch initial machine subsystem state:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialState();
    setHealthHistory({});
    setSensorHistory({});
    setTick(0);
  }, [machineId]);

  // Connect to live WebSocket stream
  useEffect(() => {
    if (!machineId) return;

    let ws: WebSocket | null = null;
    let localTick = 0;

    const connectWS = () => {
      try {
        const wsUrl = WS_URL.startsWith("ws") ? `${WS_URL}/ws/telemetry/` : `ws://${WS_URL}/ws/telemetry/`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
          ws?.send(JSON.stringify({ action: "subscribe", machine_id: machineId }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "telemetry_update") {
              setTelemetry(data.telemetry);
              if (data.machine_status && machineData) {
                setMachineData((prev: any) => prev ? { ...prev, status: data.machine_status } : null);
              }
              if (data.equipments) {
                setEquipments(data.equipments);
                
                localTick++;
                setTick(localTick);

                data.equipments.forEach((eq: any) => {
                  const eqName = eq.name;
                  const healthVal = eq.health_score !== undefined ? eq.health_score : 100.0;
                  
                  setHealthHistory((prev) => {
                    const currentHistory = prev[eqName] || [];
                    const nextHistory = [...currentHistory, { time: localTick, value: healthVal }];
                    return {
                      ...prev,
                      [eqName]: nextHistory.slice(-20)
                    };
                  });

                  Object.entries(eq.sensor_readings || {}).forEach(([sensorName, val]: any) => {
                    const sensorKey = `${eqName}_${sensorName}`;
                    setSensorHistory((prev) => {
                      const currentHistory = prev[sensorKey] || [];
                      const nextHistory = [...currentHistory, { time: localTick, value: parseFloat(val) || 0 }];
                      return {
                        ...prev,
                        [sensorKey]: nextHistory.slice(-20)
                      };
                    });
                  });
                });
              }
            }
          } catch (e) {
            console.error("WS message parse error:", e);
          }
        };

        ws.onerror = () => setWsConnected(false);
        ws.onclose = () => setWsConnected(false);
      } catch (err) {
        setWsConnected(false);
      }
    };

    connectWS();

    return () => {
      if (ws) ws.close();
    };
  }, [machineId, machineData?.id]);

  // Helper to extract nested metrics reliably
  const getSubsystemMetrics = (eq: any) => {
    if (!eq) return { subHealth: 100.0, failProb: 0.0, sensors: {} };
    const latestTelemetry = eq.recent_telemetry && eq.recent_telemetry.length > 0 
      ? eq.recent_telemetry[eq.recent_telemetry.length - 1] 
      : null;
    
    const subHealth = eq.health_score !== undefined 
      ? eq.health_score 
      : (latestTelemetry && latestTelemetry.health_score !== undefined ? latestTelemetry.health_score : 100.0);
      
    const failProb = eq.failure_probability !== undefined 
      ? eq.failure_probability 
      : (latestTelemetry && latestTelemetry.failure_probability !== undefined ? latestTelemetry.failure_probability : 0.0);
      
    const sensors = eq.sensor_readings !== undefined 
      ? eq.sensor_readings 
      : (latestTelemetry && latestTelemetry.sensor_readings ? latestTelemetry.sensor_readings : {});

    return { subHealth, failProb, sensors };
  };

  const activeSubs = equipments.length;
  const avgHealth = useMemo(() => {
    if (activeSubs === 0) return 100.0;
    return equipments.reduce((sum, eq) => sum + getSubsystemMetrics(eq).subHealth, 0) / activeSubs;
  }, [equipments, activeSubs]);
  
  const worstFailureProb = useMemo(() => {
    if (activeSubs === 0) return 0.0;
    return Math.max(...equipments.map(eq => getSubsystemMetrics(eq).failProb));
  }, [equipments, activeSubs]);

  const machineRul = Math.max(0, Math.round(2000.0 * ((avgHealth / 100.0) ** 2)));

  if (!machineData) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* 1. Machine-Level Roster */}
      <Card className="p-5 border-stone-250 dark:border-stone-850 bg-stone-900/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-extrabold uppercase bg-stone-200 dark:bg-stone-900 px-2 py-0.5 rounded text-stone-700 dark:text-stone-300">
                {machineData.serial_number}
              </span>
              <Badge variant={wsConnected ? "success" : "warning"} className="font-bold text-[9px]">
                {wsConnected ? "WS Live Stream" : "API Polled fallback"}
              </Badge>
            </div>
            <h3 className="text-md font-extrabold text-stone-900 dark:text-stone-50 mt-1.5">{machineData.name}</h3>
            <p className="text-xs text-stone-500 mt-0.5">Model: <span className="font-bold text-[#FFCD00]">{machineData.model}</span></p>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="px-4 py-2 border-r border-stone-200 dark:border-stone-800">
              <span className="text-[9px] uppercase font-bold text-stone-500 block">Overall Status</span>
              <Badge variant={machineData.status === "operational" ? "success" : machineData.status === "warning" ? "warning" : "danger"} className="mt-1">
                {machineData.status.toUpperCase()}
              </Badge>
            </div>
            <div className="px-4 py-2 border-r border-stone-200 dark:border-stone-800">
              <span className="text-[9px] uppercase font-bold text-stone-500 block">Fleet Health</span>
              <span className={`text-base font-extrabold block mt-0.5 ${avgHealth > 80 ? "text-emerald-500" : avgHealth > 60 ? "text-amber-500" : "text-red-500"}`}>
                {avgHealth.toFixed(1)}%
              </span>
            </div>
            <div className="px-4 py-2">
              <span className="text-[9px] uppercase font-bold text-stone-500 block">Machine RUL</span>
              <span className="text-base font-extrabold text-cyan-500 block mt-0.5">{machineRul} hrs</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Subsystems Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {equipments.map((eq) => {
          const { subHealth, failProb, sensors } = getSubsystemMetrics(eq);
          const isSelected = selectedSubsystem === eq.name;

          return (
            <Card
              key={eq.id}
              onClick={() => setSelectedSubsystem(eq.name)}
              className={`p-4 border cursor-pointer transition-all duration-155 flex flex-col justify-between ${
                isSelected
                  ? "border-[#FFCD00] shadow bg-amber-500/5 dark:bg-amber-500/5"
                  : "border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-700"
              }`}
            >
              <div>
                <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-850 pb-2.5">
                  <span className="font-bold text-xs uppercase tracking-wide text-stone-900 dark:text-stone-100">
                    {eq.name.replace(/_/g, " ")}
                  </span>
                  <Badge variant={eq.status === "operational" ? "success" : eq.status === "warning" ? "warning" : "danger"}>
                    {eq.status.toUpperCase()}
                  </Badge>
                </div>

                <div className="my-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-stone-500 block">Subsystem Health</span>
                    <span className={`text-base font-extrabold ${subHealth >= 90 ? "text-emerald-500" : subHealth >= 75 ? "text-amber-500" : "text-red-500"}`}>
                      {subHealth.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-stone-500 block">Fail Probability</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">{(failProb * 100).toFixed(0)}%</span>
                  </div>
                </div>

                {/* Subsystem specific live sensors with value-only state coloring */}
                <div className="space-y-2.5 mt-3 pt-3 border-t border-stone-200/50 dark:border-stone-800/40">
                  {Object.entries(sensors).map(([key, val]: any) => {
                    const evalRes = evaluateSensor(key, val);
                    const unit = SENSOR_THRESHOLDS[key]?.unit || "";
                    const displayName = key.replace(/_/g, " ");

                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-stone-400 font-medium">{displayName}</span>
                          <span className="font-mono">
                            <strong className={`font-extrabold ${evalRes.textColor}`}>{evalRes.val}</strong>{" "}
                            {unit && <span className="text-stone-400 text-[10px] font-normal">{unit}</span>}
                          </span>
                        </div>
                        {evalRes.fault && (
                          <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-[9px] space-y-0.5">
                            <span className="font-extrabold text-amber-500 block">{evalRes.fault.title}</span>
                            <div className="text-stone-400"><strong className="text-stone-300">Cause:</strong> {evalRes.fault.reason}</div>
                            <div className="text-[#FFCD00] font-bold"><strong className="text-stone-300">Action:</strong> {evalRes.fault.action}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* 3. Detailed Subsystem Analytics (Selected Subsystem) */}
      {selectedSubsystem && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Telemetry charts column */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    {selectedSubsystem.replace(/_/g, " ")} Subsystem Health Trend
                  </h4>
                  <p className="text-xs text-stone-500 mt-1">Real-time health coefficient updates</p>
                </div>
                <Badge variant="neutral">Health Score History</Badge>
              </div>

              <div className="pt-2">
                <Chart
                  data={healthHistory[selectedSubsystem] || []}
                  maxScale={100}
                  strokeColor={avgHealth > 80 ? "#10b981" : avgHealth > 60 ? "#f59e0b" : "#ef4444"}
                  height={100}
                />
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Subsystem Raw Sensor Telemetry Charts
                  </h4>
                  <p className="text-xs text-stone-500 mt-1">Live scrolling data waveform window</p>
                </div>
                <Badge variant="neutral">Sensor Waveforms</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {(() => {
                  const selectedEq = equipments.find((eq) => eq.name === selectedSubsystem);
                  const { sensors } = getSubsystemMetrics(selectedEq);
                  return Object.entries(sensors).slice(0, 2).map(([sensorName, val]: any) => {
                    const sensorKey = `${selectedSubsystem}_${sensorName}`;
                    const history = sensorHistory[sensorKey] || [];
                    const maxScale = sensorName.toLowerCase().includes("vibration")
                      ? 6.0
                      : sensorName.toLowerCase().includes("temp")
                      ? 120.0
                      : sensorName.toLowerCase().includes("rpm")
                      ? 2200.0
                      : 100.0;

                    return (
                      <div key={sensorName} className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-stone-500 block">
                          {sensorName.replace(/_/g, " ")} Waveform ({val})
                        </span>
                        <Chart data={history} maxScale={maxScale} strokeColor="#FFCD00" height={80} />
                      </div>
                    );
                  });
                })()}
              </div>
            </Card>
          </div>

          {/* ML inference diagnostic cards */}
          <div className="space-y-6">
            <Card className="p-5 flex flex-col justify-between">
              {(() => {
                const selectedEq = equipments.find(e => e.name === selectedSubsystem);
                const { subHealth } = getSubsystemMetrics(selectedEq);
                return (
                  <>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-4">FastAPI AI Inference Diagnostics</h4>
                      <div className="space-y-3.5">
                        <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-250 dark:border-stone-850 text-xs">
                          <span className="text-[9px] uppercase font-bold text-stone-400 block mb-1">Subsystem Health Coefficient</span>
                          <div className="flex justify-between items-center mt-0.5">
                            <span className="font-bold">Estimated Anomaly Score:</span>
                            <span className="font-mono font-extrabold text-amber-500">
                              {(1.0 - subHealth / 100.0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-stone-50 dark:bg-stone-950/65 rounded border border-stone-250 dark:border-stone-850 text-xs">
                          <span className="text-[9px] uppercase font-bold text-stone-400 block mb-1">Predicted Failure Mode</span>
                          <span className="font-bold text-stone-800 dark:text-stone-200 mt-1 block">
                            {subHealth < 75
                              ? `${selectedSubsystem.toUpperCase()} WEAR DEGRADATION`
                              : "Normal Operating Limits"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-stone-250 dark:border-stone-850 text-xs text-stone-500 mt-4 leading-5">
                      {subHealth < 75
                        ? `AI Recommendation: Scheduled inspection on ${selectedSubsystem.toLowerCase()} mechanical bearings/connections required. Monitor telemetry closely for temperature threshold deviations.`
                        : "All telemetry values reside within designated physical limits. No operational interventions recommended."}
                    </div>
                  </>
                );
              })()}
            </Card>
          </div>

        </div>
      )}

    </div>
  );
};
