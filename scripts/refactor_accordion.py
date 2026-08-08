import re

with open('frontend/src/pages/CalibrationPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Locate step === 1 render block start and end, and replace it
step1_old_start = '      {step === 1 && (\n        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in items-start">'
step1_old_end = '        </div>\n      )}'

# We will do a direct string replace of the entire block from the step === 1 wrapper
# Let's target the exact structure of step === 1 from the file
start_index = content.find('      {step === 1 && (')
# Find the corresponding end. It ends right before STEP 2 comment
end_index = content.find('      {/* ==========================================\n          STEP 2: MOTION VERIFICATION')

if start_index != -1 and end_index != -1:
    old_step1_block = content[start_index:end_index]
    
    new_step1_block = """      {step === 1 && (
        <div className="w-full animate-fade-in">
              
          {/* MAIN CARD: Component list */}
          <div className="neu-panel p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-slate-300">
              <h4 className="font-bold text-slate-800 text-lg">Component Diagnostics</h4>
              {!linkEstablished ? (
                <button
                  onClick={connectDevice}
                  disabled={connecting}
                  className="neu-button-primary px-6 py-2.5 text-sm font-bold flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {connecting ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Connecting...</>
                  ) : (
                    <><Wifi className="w-4 h-4" /> Establish Link</>
                  )}
                </button>
              ) : (
                <button 
                  onClick={disconnectDevice}
                  className="neu-button px-4 py-2 text-xs font-bold text-slate-500 hover:text-red-500"
                >
                  Disconnect Link
                </button>
              )}
            </div>
            <div className="space-y-4">
                
              <div className="space-y-4">
                {componentRows.map((row, idx) => {
                  const isActive = activeSensorIndex === idx;
                  const status = row.statusKey === 'esp32' ? (deviceConnected ? 'ready' : 'disconnected') : sensorStatuses[row.statusKey];
                  return (
                    <div 
                      key={row.id}
                      className={`flex flex-col p-5 rounded-2xl transition duration-300 ease-in-out ${
                        isActive ? 'neu-panel-inset' : 'neu-button opacity-80 cursor-pointer'
                      } ${!linkEstablished && idx > 0 ? 'pointer-events-none opacity-40' : ''}`}
                    >
                      {/* Accordion Row Header */}
                      <div 
                        onClick={() => {
                          setActiveSensorIndex(idx);
                          // Auto set status to calibrating if we select it manually and it is pending
                          if (sensorStatuses[row.statusKey] === 'pending') {
                            setSensorStatuses(prev => ({ ...prev, [row.statusKey]: 'calibrating' }));
                          }
                        }}
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-4"
                      >
                        <div>
                          <span className="font-bold text-slate-800 text-base block">{row.name}</span>
                          <span className="text-xs text-slate-400 font-medium">{row.model}</span>
                        </div>

                        {/* Middle Icons row matching the Finger row mockup */}
                        {row.icons && (
                          <div className="flex items-center gap-2 py-2 sm:py-0 px-3 rounded-lg neu-panel-inset">
                            <Cpu className="w-4 h-4 text-slate-400" />
                            <div className="w-0.5 h-4 bg-slate-100" />
                            <Sliders className="w-4 h-4 text-slate-400" />
                            <div className="w-0.5 h-4 bg-slate-100" />
                            <Layers className="w-4 h-4 text-slate-400" />
                            <div className="w-0.5 h-4 bg-slate-100" />
                            <Gauge className="w-4 h-4 text-slate-400" />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {status === 'ready' && (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 stroke-[3]" /> {idx === 0 ? 'Connected' : 'Ready'}
                            </span>
                          )}
                          {status === 'disconnected' && (
                            <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full flex items-center gap-1 uppercase">
                              <X className="w-3.5 h-3.5 stroke-[3]" /> Disconnected
                            </span>
                          )}
                          {status === 'calibrating' && (
                            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full animate-pulse uppercase">
                              Active Check...
                            </span>
                          )}
                          {status === 'skipped' && (
                            <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-bold rounded-full uppercase">
                              Skipped
                            </span>
                          )}
                          {status === 'pending' && (
                            <span className="px-3 py-1 bg-slate-100 text-slate-400 text-xs font-bold rounded-full uppercase">
                              Pending
                            </span>
                          )}
                          <span className={`text-slate-500 transition-transform duration-300 text-sm ${isActive ? 'rotate-180' : ''}`}>
                            &#x25BE;
                          </span>
                        </div>
                      </div>

                      {/* Accordion Row Collapsible Details */}
                      {isActive && (
                        <div className="mt-5 pt-5 border-t border-slate-300 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                          {/* Expanded Left: 3D or 2D Visualizer */}
                          <div className="flex flex-col space-y-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Visual Diagnostics</span>
                            {idx === 3 ? (
                              <div className="h-80 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-inner relative flex items-center justify-center">
                                <WristCalibrationViewer 
                                  sideAngle={sideAngle} 
                                  bendAngle={bendAngle} 
                                />
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-64 items-center">
                                <div className="flex items-center justify-center neu-panel h-full rounded-xl p-4">
                                  {idx === 0 && <Esp32Svg status={status} />}
                                  {idx === 1 && <FlexGloveSvg status={status} />}
                                  {idx === 2 && <ElbowPressureSvg status={status} />}
                                  {idx === 4 && <ElbowPressureSvg status={status} />}
                                </div>
                                <div className="h-full bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                  <LiveVisualizer sensorIndex={idx} telemetry={lastTelemetry} />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Expanded Right: Telemetry Charts, status, and manual controls */}
                          <div className="flex flex-col space-y-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Live Stream Waveforms</span>
                            
                            {idx === 0 && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                  <span>Connection Status</span>
                                  <span className={deviceConnected ? "text-emerald-500 font-bold" : "text-red-500 font-bold animate-pulse"}>
                                    {deviceConnected ? "ACTIVE" : "INACTIVE"}
                                  </span>
                                </div>
                                <LiveChart value={lastTelemetry ? 1 : 0} minVal={0} maxVal={1} color="#10B981" />
                              </div>
                            )}

                            {idx === 1 && (
                              <div className="space-y-3">
                                {lastTelemetry && (
                                  <div className="grid grid-cols-5 gap-1.5 text-center">
                                    {['thumb', 'index', 'middle', 'ring', 'little'].map((finger) => (
                                      <div key={finger} className="neu-panel p-1.5 rounded-lg">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase block">{finger.slice(0, 3)}</span>
                                        <span className="text-xs font-bold text-slate-700">{lastTelemetry[finger]}%</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div>
                                  <div className="flex justify-between text-[11px] font-bold text-slate-600 mb-1">
                                    <span>Index Finger Flexion</span>
                                    <span>{lastTelemetry?.index || 0}%</span>
                                  </div>
                                  <LiveChart value={lastTelemetry?.index || 0} minVal={0} maxVal={100} color="#3B82F6" />
                                </div>
                              </div>
                            )}

                            {idx === 2 && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                  <span>Elbow Bend Angle</span>
                                  <span className="font-bold text-primary">{lastTelemetry?.elbow || 180}°</span>
                                </div>
                                <LiveChart value={lastTelemetry?.elbow || 180} minVal={90} maxVal={180} color="#F59E0B" />
                              </div>
                            )}

                            {idx === 3 && (
                              <div className="space-y-3">
                                {lastTelemetry && !lastTelemetry.mpu_working && (
                                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-100 text-[10px] font-semibold text-red-700 flex items-start gap-1.5 leading-relaxed">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold block">MPU6050 Disconnected</span>
                                      The ESP32 reported that the MPU6050 chip is not detected on the I2C bus. Check your SDA/SCL wire connections!
                                    </div>
                                  </div>
                                )}

                                <div className="neu-panel-inset p-2.5 rounded-lg grid grid-cols-2 gap-2 text-center">
                                  <div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">X-Axis (Pitch)</span>
                                    <span className="text-xs font-bold text-slate-700">{lastTelemetry?.wrist_pitch || 0}°</span>
                                    <span className="text-[8px] font-semibold text-slate-400 block mt-0.5">
                                      {(lastTelemetry?.wrist_pitch || 0) > 5 ? 'Extension (Up)' : (lastTelemetry?.wrist_pitch || 0) < -5 ? 'Flexion (Down)' : 'Neutral'}
                                    </span>
                                  </div>
                                  <div className="border-l border-slate-200">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Y-Axis (Roll)</span>
                                    <span className="text-xs font-bold text-slate-700">{lastTelemetry?.wrist_roll || 0}°</span>
                                    <span className="text-[8px] font-semibold text-slate-400 block mt-0.5">
                                      {(lastTelemetry?.wrist_roll || 0) > 5 ? 'Pronation (Right)' : (lastTelemetry?.wrist_roll || 0) < -5 ? 'Supination (Left)' : 'Neutral'}
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                                      <span>Pitch Range (Up/Down)</span>
                                      <span>{lastTelemetry?.wrist_pitch || 0}°</span>
                                    </div>
                                    <LiveChart value={lastTelemetry?.wrist_pitch || 0} minVal={-90} maxVal={90} color="#3B82F6" />
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                                      <span>Roll Range (Left/Right)</span>
                                      <span>{lastTelemetry?.wrist_roll || 0}°</span>
                                    </div>
                                    <LiveChart value={lastTelemetry?.wrist_roll || 0} minVal={-90} maxVal={90} color="#10B981" />
                                  </div>
                                </div>

                                <div className="space-y-3 pt-2.5 border-t border-slate-200">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">3D Wrist Prototype Controls</span>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-0.5">
                                        <span>Left ↔ Right (Side-to-Side)</span>
                                        <span className="font-bold text-emerald-500">{sideAngle}°</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="-45" 
                                        max="45" 
                                        value={sideAngle} 
                                        onChange={(e) => setSideAngle(Number(e.target.value))} 
                                        className="w-full accent-emerald-500 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-0.5">
                                        <span>Up ↕ Down (Wrist Bend)</span>
                                        <span className="font-bold text-blue-500">{bendAngle}°</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="-45" 
                                        max="45" 
                                        value={bendAngle} 
                                        onChange={(e) => setBendAngle(Number(e.target.value))} 
                                        className="w-full accent-blue-500 cursor-pointer h-1 bg-slate-200 rounded-lg appearance-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {idx === 4 && (
                              <div className="space-y-2">
                                <div className="flex justify-between text-xs font-semibold text-slate-600">
                                  <span>Palmar Force (Pressure)</span>
                                  <span className="font-bold text-emerald-500">{lastTelemetry?.pressure || 0} N</span>
                                </div>
                                <LiveChart value={lastTelemetry?.pressure || 0} minVal={0} maxVal={800} color="#10B981" />
                              </div>
                            )}
                          </div>

                          {/* Expanded Bottom: Status Banner & Row Actions */}
                          <div className="col-span-1 md:col-span-2 pt-4 border-t border-slate-300 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition w-full sm:w-auto sm:flex-1 ${
                              status === 'ready' 
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                : status === 'disconnected'
                                ? 'bg-red-50 border-red-100 text-red-700'
                                : status === 'skipped'
                                ? 'bg-amber-50 border-amber-100 text-amber-700'
                                : 'bg-blue-50 border-blue-100 text-blue-700 animate-pulse'
                            }`}>
                              <span>
                                {status === 'ready' && (idx === 0 ? 'STATUS: CONNECTED (Active Data Stream)' : 'STATUS: CALIBRATED (Active Data Stream)')}
                                {status === 'disconnected' && 'STATUS: DISCONNECTED (Telemetry Offline)'}
                                {status === 'skipped' && 'STATUS: BYPASSED / SKIPPED'}
                                {status === 'calibrating' && (
                                  idx === 1 ? 'CALIBRATING: Flex your fingers now...' :
                                  idx === 2 ? 'CALIBRATING: Bend your elbow back and forth...' :
                                  idx === 3 ? 'CALIBRATING: Rotate and tilt your wrist...' :
                                  idx === 4 ? 'CALIBRATING: Squeeze palm force sensor...' : 
                                  'CALIBRATING: Establishing connection link...'
                                )}
                              </span>
                              {(status === 'ready' || status === 'skipped') && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              )}
                              {status === 'disconnected' && (
                                <AlertCircle className="w-4 h-4 text-red-650 animate-pulse" />
                              )}
                            </div>

                            <div className="flex gap-3 w-full sm:w-auto">
                              {status === 'calibrating' && idx > 0 && (
                                <button 
                                  onClick={handleSkipSensor}
                                  className="px-6 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer"
                                >
                                  Skip Sensor
                                </button>
                              )}
                              <button 
                                onClick={handleNextSensor}
                                disabled={status !== 'ready' && status !== 'skipped'}
                                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-slate-900/10"
                              >
                                Next Sensor Diagnostics
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Info bar */}
              <div className="flex justify-between items-center pt-2 border-t border-slate-300 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  {linkEstablished && <RefreshCw className="w-4 h-4 text-primary animate-spin" />}
                  <span>{linkEstablished ? 'Real-time link streaming at 10Hz' : 'Awaiting connection...'}</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setStep(2)}
                  disabled={Object.values(sensorStatuses).some(s => s === 'pending' || s === 'calibrating')}
                  className="w-full py-3 neu-button-primary rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Continue to Motion Verification &rarr;
                </button>
              </div>

            </div>
          </div>
        </div>
      )"""
    
    content = content.replace(old_step1_block, new_step1_block)
    
    with open('frontend/src/pages/CalibrationPage.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS")
else:
    print("ERROR: Indexes not found", start_index, end_index)
