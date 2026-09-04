import React, { useState, useEffect, useRef } from 'react';

const DataCollectionPage = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [exercise, setExercise] = useState('Ball Squeeze');
  const [label, setLabel] = useState('Correct');
  const [recordings, setRecordings] = useState([]);
  
  // Real-time stats
  const [currentPacket, setCurrentPacket] = useState(null);
  const [packetCount, setPacketCount] = useState(0);

  const wsRef = useRef(null);
  
  useEffect(() => {
    // Connect to WebSocket
    const connectWs = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsHost = host.includes(':5173') ? host.replace(':5173', ':8000') : host;
      const wsUrl = `${protocol}//${wsHost}/api/v1/device/ws`;
      
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => setIsConnected(true);
      wsRef.current.onclose = () => setIsConnected(false);
      
      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setCurrentPacket(data);
          
          if (isRecording) {
            setRecordings(prev => [...prev, data]);
            setPacketCount(prev => prev + 1);
          }
        } catch (e) {
          console.error("Failed to parse telemetry:", e);
        }
      };
    };

    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      // Stop recording
      setIsRecording(false);
    } else {
      // Start recording
      setRecordings([]);
      setPacketCount(0);
      setIsRecording(true);
    }
  };

  const downloadCSV = () => {
    if (recordings.length === 0) return;
    
    // Define the columns based on the expected features
    const columns = ['timestamp', 'exercise', 'label', 'thumb', 'index', 'middle', 'ring', 'little', 'elbow', 'pressure', 'wrist_pitch', 'wrist_roll'];
    
    // Create CSV header
    let csvContent = "data:text/csv;charset=utf-8," + columns.join(",") + "\n";
    
    // Create rows
    recordings.forEach((row, i) => {
      const rowData = [
        i, // pseudo timestamp/index
        exercise,
        label,
        row.thumb || 0,
        row.index || 0,
        row.middle || 0,
        row.ring || 0,
        row.little || 0,
        row.elbow || 0,
        row.pressure || 0,
        row.wrist_pitch || 0,
        row.wrist_roll || 0
      ];
      csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `${exercise.replace(/\s+/g, '_')}_${label}_${new Date().getTime()}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-8 pt-24 font-outfit">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black font-syne tracking-tight">ML Data Collection</h1>
            <p className="text-slate-500 mt-2">Record raw telemetry from the ESP32 to build a custom Random Forest dataset.</p>
          </div>
          <div className={`px-4 py-2 rounded-full font-bold text-sm ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isConnected ? 'Hardware Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Exercise Selection */}
            <div className="space-y-2">
              <label className="font-bold text-sm text-slate-700">Exercise Type</label>
              <select 
                value={exercise} 
                onChange={(e) => setExercise(e.target.value)}
                disabled={isRecording}
                className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500"
              >
                <option value="Ball Squeeze">Ball Squeeze</option>
                <option value="Wrist Flexion">Wrist Flexion</option>
                <option value="Elbow Curl">Elbow Curl</option>
                <option value="Idle">Idle (Baseline)</option>
              </select>
            </div>

            {/* Label Selection */}
            <div className="space-y-2">
              <label className="font-bold text-sm text-slate-700">Form Quality (Label)</label>
              <select 
                value={label} 
                onChange={(e) => setLabel(e.target.value)}
                disabled={isRecording}
                className="w-full p-3 rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500"
              >
                <option value="Correct">Correct Form</option>
                <option value="Incomplete">Incomplete / Half-Rep</option>
                <option value="Over_Compensating">Over-compensating</option>
              </select>
            </div>
          </div>

          {/* Recording Controls */}
          <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
            <button
              onClick={toggleRecording}
              className={`px-8 py-3 rounded-xl font-bold text-white transition-all ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            {!isRecording && recordings.length > 0 && (
              <button
                onClick={downloadCSV}
                className="px-8 py-3 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-900 transition-all"
              >
                Download CSV ({packetCount} packets)
              </button>
            )}

            {isRecording && (
              <div className="text-sm font-bold text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Capturing... {packetCount} packets
              </div>
            )}
          </div>
        </div>

        {/* Live Telemetry Monitor */}
        <div className="bg-slate-900 text-green-400 p-6 rounded-2xl font-mono text-sm shadow-inner overflow-hidden relative">
          <h3 className="text-white font-bold mb-4 font-sans uppercase tracking-widest text-xs opacity-50">Live Sensor Stream</h3>
          {currentPacket ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>Thumb: {currentPacket.thumb}</div>
              <div>Index: {currentPacket.index}</div>
              <div>Elbow: {currentPacket.elbow}°</div>
              <div>Pressure: {currentPacket.pressure}</div>
              <div>Pitch: {currentPacket.wrist_pitch?.toFixed(1)}°</div>
              <div>Roll: {currentPacket.wrist_roll?.toFixed(1)}°</div>
            </div>
          ) : (
            <div className="opacity-50">Waiting for data...</div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DataCollectionPage;
