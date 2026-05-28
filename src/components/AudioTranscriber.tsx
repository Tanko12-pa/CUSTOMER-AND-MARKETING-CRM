import React, { useState } from "react";
import { Sparkles, Mic, Headphones, Volume2, Globe, FileText, Check } from "lucide-react";

interface AudioTranscriberProps {
  onUpdateState: (type: string, payload: any) => Promise<void>;
  customers: Array<{ uid: string; name: string }>;
}

const SAMPLE_VOICE_PRESETS = [
  {
    lang: "Spanish",
    speaker: "Genevieve Thorne",
    text_preview: "Hola, necesitamos optimizar las bases de datos en Firestore para que no haya retrasos de webhook.",
  },
  {
    lang: "Yoruba",
    speaker: "Almaric Vance",
    text_preview: "Eku oju mo, a nilo iranlowo lati se agbega si plan Pro fun egbe wa lati ri data gidi gba.",
  },
  {
    lang: "French",
    speaker: "Elena Rostova",
    text_preview: "Bonjour, nous apprécions l'intégration de Firebase mais nous avons besoin d'un audit de conformité SOC 2.",
  },
  {
    lang: "English",
    speaker: "Takeshi Kovacs",
    text_preview: "Hey team, the predictive analytics win model is absolutely stellar. Track this contract value on Firestore.",
  }
];

export function AudioTranscriber({ onUpdateState, customers }: AudioTranscriberProps) {
  const [selectedLanguage, setSelectedLanguage] = useState("Spanish");
  const [speakerName, setSpeakerName] = useState("Genevieve Thorne");
  const [customPrompt, setCustomPrompt] = useState(SAMPLE_VOICE_PRESETS[0].text_preview);
  const [transcriptionResult, setTranscriptionResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(false);

  const handleSelectPreset = (preset: typeof SAMPLE_VOICE_PRESETS[0]) => {
    setSelectedLanguage(preset.lang);
    setSpeakerName(preset.speaker);
    setCustomPrompt(preset.text_preview);
  };

  const handleTranscribe = async () => {
    if (!customPrompt.trim()) return;
    setLoading(true);
    setTranscriptionResult("");
    
    try {
      const response = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: selectedLanguage,
          sourceName: speakerName,
          mockAudioPrompt: customPrompt
        })
      });
      const data = await response.json();
      setTranscriptionResult(data.text);
      // Refresh database logs
      onUpdateState("REFRESH_LOGS", {});
    } catch (e) {
      console.error(e);
      setTranscriptionResult("Error occurred during transcription.");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulatePlayback = () => {
    setPlayingVoice(true);
    // Beep sound check
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // Standard A4 note
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Audio Context init disabled or blocked by browser frame sandbox rules.");
    }
    setTimeout(() => {
      setPlayingVoice(false);
    }, 1800);
  };

  return (
    <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A]" id="audio-diary-transcriber-dashboard">
      <div className="flex items-center justify-between border-b border-[#27272A] pb-4 mb-5">
        <div className="flex items-center space-x-2.5">
          <Headphones className="w-5 h-5 text-[#C5A059]" />
          <h3 className="text-lg font-bold text-[#E4E4E7] tracking-tight font-display">Ecosystem Multilingual Audio Transcriber</h3>
        </div>
        <span className="text-[10px] bg-[#C5A059]/10 border border-[#C5A059]/30 text-[#C5A059] font-bold font-mono px-2.5 py-1 rounded-xl uppercase">100+ World Languages</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Presets & options form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-[#A1A1AA] uppercase tracking-wider font-sans">Select Audio Scenario Preset</h4>
            <p className="text-[11px] text-[#A1A1AA]/80">Instantly simulate multi-language client transcripts logged from voice integrations:</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" id="scenarios-presets-grid">
            {SAMPLE_VOICE_PRESETS.map((p) => (
              <button
                key={p.lang}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`p-2.5 text-left rounded-xl border text-xs transition-all duration-200 cursor-pointer ${selectedLanguage === p.lang ? "bg-[#0A0A0B] border-[#C5A059] font-semibold text-[#C5A059]" : "bg-[#141416] border-[#27272A] hover:border-[#A1A1AA]/55 text-[#E4E4E7]"}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-[11px] font-bold ${selectedLanguage === p.lang ? "text-[#C5A059]" : "text-[#E4E4E7]"}`}>{p.lang}</span>
                  <Globe className="w-3.5 h-3.5 text-[#A1A1AA]/50" />
                </div>
                <p className="text-[10px] text-[#A1A1AA] truncate">Speaker: {p.speaker}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-[#27272A] pt-3 space-y-3.5">
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1 font-sans">Language Node</label>
                <input
                  type="text"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-[#E4E4E7] focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1 font-sans">Speaker Reference</label>
                <input
                  type="text"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-[#E4E4E7] focus:outline-none focus:border-[#C5A059]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#A1A1AA] uppercase mb-1 font-sans">Simulated Sound Recording Script</label>
              <textarea
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full bg-[#0A0A0B] border border-[#27272A] rounded-xl p-3 text-xs text-[#E4E4E7] focus:border-[#C5A059] focus:outline-none font-sans"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSimulatePlayback}
                className={`py-2 px-3.5 border border-[#A1A1AA]/55 text-[#E4E4E7] hover:bg-white/5 rounded-xl font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer ${playingVoice ? "animate-pulse" : ""}`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{playingVoice ? "🎙️ Playing Audio..." : "Play Voice Source"}</span>
              </button>

              <button
                type="button"
                onClick={handleTranscribe}
                disabled={loading}
                className="bg-[#C5A059] hover:bg-[#C5A059]/90 text-[#0A0A0B] text-xs font-bold py-2.5 px-4 rounded-xl flex items-center space-x-1.5 transition-all shadow-md cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0A0A0B]" />
                <span>Transcribe Sound & Log</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live results summary panel */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0A0A0B] rounded-2xl p-5 border border-[#27272A] flex flex-col justify-between h-full min-h-[300px]" id="transcription-outcome-panel">
            <div>
              <div className="flex items-center space-x-1.5 pb-2 border-b border-[#27272A] mb-3 text-[#A1A1AA] text-xs font-bold uppercase tracking-wider">
                <FileText className="w-4 h-4 text-[#C5A059]" />
                <span>Gemini Speech Transcriber Outcome</span>
              </div>

              {loading && (
                <div className="py-12 flex flex-col items-center justify-center space-y-2">
                  <div className="w-8 h-8 rounded-full border-2 border-[#C5A059] border-t-transparent animate-spin"></div>
                  <span className="text-xs text-[#A1A1AA] font-mono">Gemini analyzing audio wave context...</span>
                </div>
              )}

              {!loading && !transcriptionResult && (
                <div className="py-12 text-center text-[#A1A1AA] font-mono text-xs max-w-sm mx-auto">
                  <span>Prepare an audio script scenario or select a translation preset, then click "Transcribe Sound & Log".</span>
                </div>
              )}

              {!loading && transcriptionResult && (
                <div className="text-xs font-mono text-[#E4E4E7] leading-relaxed max-h-[240px] overflow-y-auto whitespace-pre-wrap select-all bg-[#141416] p-4 rounded-xl border border-[#27272A]">
                  {transcriptionResult}
                </div>
              )}
            </div>

            {/* Bottom info banner */}
            <div className="bg-[#C5A059]/10 rounded-xl p-3 border border-[#C5A059]/20 mt-4 flex items-center space-x-2.5 text-[10px] text-[#C5A059]">
              <Volume2 className="w-5 h-5 shrink-0" />
              <span>
                <strong>System Governance Notice</strong>: Local language recognition performs real-time audio chunk verification and converts speech telemetry inputs cleanly into English database fields.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
