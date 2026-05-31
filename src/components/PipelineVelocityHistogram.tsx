import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Customer, LifecycleStage } from "../types";
import { Clock, HelpCircle, BarChart3, TrendingUp, Info } from "lucide-react";

interface PipelineVelocityHistogramProps {
  customers: Customer[];
}

export function PipelineVelocityHistogram({ customers }: PipelineVelocityHistogramProps) {
  const [selectedStage, setSelectedStage] = useState<LifecycleStage>("Lead");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredBin, setHoveredBin] = useState<{ x0: number; x1: number; count: number; accounts: string[] } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const stages: LifecycleStage[] = ["Lead", "MQL", "SQL", "Customer"];

  const stageColors: Record<LifecycleStage, string> = {
    Lead: "#3B82F6",      // Blue
    MQL: "#8B5CF6",       // Violet
    SQL: "#F59E0B",       // Amber/Gold
    Customer: "#10B981",  // Emerald
    Churned: "#EF4444",   // Red
  };

  // Determine stage description
  const stageLabels: Record<LifecycleStage, string> = {
    Lead: "Time Spent as Lead (before MQL qualification)",
    MQL: "Marketing Qualification Speed (MQL to SQL)",
    SQL: "Sales Cycle Progression Speed (SQL to Active Contract)",
    Customer: "Customer Lifetime Active Duration",
    Churned: "Time before cancellation"
  };

  // Calculate durations for each customer who has been in the selected stage
  const durationsData = useMemo(() => {
    const list: { customerName: string; days: number }[] = [];

    customers.forEach((c) => {
      if (!c.stageHistory || !c.stageHistory[selectedStage]) return;

      const currentStageDate = new Date(c.stageHistory[selectedStage] as string).getTime();

      // Find the next stage transition (the chronologically next timestamp)
      const otherTimestamps = Object.entries(c.stageHistory)
        .map(([st, val]) => ({ stage: st, time: new Date(val as string).getTime() }))
        .filter((item) => item.time > currentStageDate);

      let endTimestamp = new Date().getTime();
      if (otherTimestamps.length > 0) {
        // Earliest timestamp that occurred after the current stage
        endTimestamp = Math.min(...otherTimestamps.map((t) => t.time));
      }

      const diffDays = (endTimestamp - currentStageDate) / (1000 * 3600 * 24);
      list.push({
        customerName: c.name,
        days: Math.max(0.1, diffDays),
      });
    });

    return list;
  }, [customers, selectedStage]);

  // Calculations for KPI details
  const stats = useMemo(() => {
    const days = durationsData.map((d) => d.days);
    if (days.length === 0) return { avg: 0, min: 0, max: 0, total: 0 };
    const avg = days.reduce((acc, v) => acc + v, 0) / days.length;
    const min = Math.min(...days);
    const max = Math.max(...days);
    return { avg, min, max, total: days.length };
  }, [durationsData]);

  // Re-draw histogram when durationsData changes or window resizes
  useEffect(() => {
    if (!svgRef.current || durationsData.length === 0) return;

    const margin = { top: 25, right: 25, bottom: 40, left: 45 };
    const width = 500;
    const height = 210;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("width", "100%")
      .attr("height", "155px")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const daysVals = durationsData.map((d) => d.days);
    const maxVal = (d3.max(daysVals) as any) || 10;

    // Set up X axis scale
    const xScale = d3
      .scaleLinear()
      .domain([0, maxVal * 1.05])
      .range([0, chartWidth]);

    // Setup bin generator
    const binCount = Math.min(8, Math.max(3, Math.round(durationsData.length / 1.5)));
    const histogram = d3
      .bin()
      .domain(xScale.domain() as [number, number])
      .thresholds(xScale.ticks(binCount));

    const bins = histogram(daysVals);

    // Map customers of each bin for accurate tooltip reporting
    const interactiveBins = bins.map((bin) => {
      const b0 = bin.x0 ?? 0;
      const b1 = bin.x1 ?? 0;
      const binCustomers = durationsData
        .filter((d) => d.days >= b0 && d.days < b1)
        .map((d) => d.customerName);
      
      return {
        x0: b0,
        x1: b1,
        count: bin.length,
        accounts: binCustomers,
      };
    });

    // Set up Y axis scale
    const maxCount = d3.max(bins, (d) => d.length) || 1;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxCount + 0.5])
      .range([chartHeight, 0]);

    // Color gradient setup
    const stageColor = stageColors[selectedStage];
    const gradId = `hist-grad-${selectedStage}`;
    
    // Add linear gradient
    const defs = svg.append("defs");
    const linearGradient = defs
      .append("linearGradient")
      .attr("id", gradId)
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");

    linearGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", stageColor)
      .attr("stop-opacity", 0.9);

    linearGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", stageColor)
      .attr("stop-opacity", 0.35);

    // Grid lines for frequency helper
    g.append("g")
      .attr("class", "grid")
      .call(
        d3.axisLeft(yScale)
          .ticks(Math.min(5, maxCount))
          .tickSize(-chartWidth)
          .tickFormat(() => "")
      )
      .selectAll(".tick line")
      .attr("stroke", "#27272A")
      .attr("stroke-width", "1px")
      .attr("stroke-dasharray", "3,3");

    // X Axis lines and formatting
    const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d) => `${d}d`);
    const xAxisG = g
      .append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xAxis);

    xAxisG.selectAll(".tick text")
      .attr("fill", "#71717A")
      .attr("font-size", "10px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("dy", "10px");
    xAxisG.select(".domain").attr("stroke", "#27272A");
    xAxisG.selectAll(".tick line").attr("stroke", "#27272A");

    // Y Axis frequency lines
    const yAxis = d3.axisLeft(yScale).ticks(Math.min(5, maxCount)).tickFormat(d3.format("d"));
    const yAxisG = g.append("g").call(yAxis);

    yAxisG.selectAll(".tick text")
      .attr("fill", "#71717A")
      .attr("font-size", "10px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("dx", "-6px");
    yAxisG.select(".domain").attr("stroke", "#27272A");
    yAxisG.selectAll(".tick line").attr("stroke", "#27272A");

    // Bars Group
    const barGroups = g
      .selectAll(".bar")
      .data(interactiveBins)
      .enter()
      .append("g")
      .attr("class", "bar-group");

    // Draw background placeholder bars
    barGroups
      .append("rect")
      .attr("x", (d) => xScale(d.x0) + 1.5)
      .attr("y", 0)
      .attr("width", (d) => Math.max(0, xScale(d.x1) - xScale(d.x0) - 3))
      .attr("height", chartHeight)
      .attr("fill", "#27272A")
      .attr("opacity", 0.03)
      .attr("rx", 3);

    // Draw active frequency bars
    const barRects = barGroups
      .append("rect")
      .attr("x", (d) => xScale(d.x0) + 1.5)
      .attr("y", chartHeight) // Animation start
      .attr("width", (d) => Math.max(1, xScale(d.x1) - xScale(d.x0) - 3))
      .attr("height", 0)
      .attr("fill", `url(#${gradId})`)
      .attr("stroke", stageColor)
      .attr("stroke-width", "1px")
      .attr("opacity", 0.85)
      .attr("rx", 4)
      .style("cursor", "pointer")
      .style("filter", `drop-shadow(0 0 4px ${stageColor}15)`);

    // Entrance Animation utilizing transition
    barRects
      .transition()
      .duration(750)
      .delay((d, i) => i * 65)
      .attr("y", (d) => yScale(d.count))
      .attr("height", (d) => chartHeight - yScale(d.count));

    // Interactive mouse trackers
    barRects
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("opacity", 1.0)
          .attr("stroke-width", "2px")
          .style("filter", `drop-shadow(0 0 8px ${stageColor}40)`);

        setHoveredBin({
          x0: d.x0,
          x1: d.x1,
          count: d.count,
          accounts: d.accounts,
        });

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setTooltipPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        }
      })
      .on("mousemove", function (event) {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setTooltipPos({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          });
        }
      })
      .on("mouseleave", function () {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("opacity", 0.85)
          .attr("stroke-width", "1px")
          .style("filter", `drop-shadow(0 0 4px ${stageColor}15)`);

        setHoveredBin(null);
        setTooltipPos(null);
      });

    // Average line indicator
    if (stats.avg > 0) {
      const avgX = xScale(stats.avg);

      // Draw dashed average indicators
      g.append("line")
        .attr("x1", avgX)
        .attr("x2", avgX)
        .attr("y1", -5)
        .attr("y2", chartHeight)
        .attr("stroke", "#C5A059")
        .attr("stroke-width", "1.5px")
        .attr("stroke-dasharray", "4,4")
        .style("filter", "drop-shadow(0 0 4px rgba(197, 160, 89, 0.45))")
        .attr("opacity", 0)
        .transition()
        .duration(800)
        .delay(400)
        .attr("opacity", 0.95);

      // Label average indicator
      g.append("text")
        .attr("x", avgX + 6)
        .attr("y", 12)
        .attr("fill", "#C5A059")
        .attr("font-size", "9px")
        .attr("font-family", "JetBrains Mono, monospace")
        .attr("font-weight", "bold")
        .text(`AVG: ${stats.avg.toFixed(1)}d`)
        .attr("opacity", 0)
        .transition()
        .duration(800)
        .delay(500)
        .style("opacity", 1);
    }

  }, [durationsData, selectedStage, stats]);

  return (
    <div
      ref={containerRef}
      className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl relative overflow-visible flex flex-col h-full justify-between"
      id="pipeline-velocity-histograms-card"
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#E4E4E7] tracking-tight">Pipeline Velocity Histograms</h3>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">Duration Distribution Analytics</p>
            </div>
          </div>

          {/* Quick Stats Summary badges */}
          {stats.total > 0 && (
            <div className="flex items-center space-x-2 bg-[#0A0A0B] px-3 py-1.5 rounded-xl border border-[#27272A]/70 text-[10px] font-mono shrink-0">
              <span className="text-zinc-500 font-bold">AVG:</span>
              <span className="text-[#C5A059] font-extrabold">{stats.avg.toFixed(1)} days</span>
              <span className="text-zinc-700">|</span>
              <span className="text-zinc-500 font-bold">N:</span>
              <span className="text-[#E4E4E7] font-semibold">{stats.total} accounts</span>
            </div>
          )}
        </div>

        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          Analyze conversion efficiency by visualizing how many days profiles spend within specific pipeline stages. Click any stage tab to load interactive bins.
        </p>

        {/* Dynamic Stage Tabs */}
        <div className="flex flex-wrap gap-1.5 bg-[#0A0A0B] p-1 rounded-xl border border-[#27272A]/80 max-w-md">
          {stages.map((st) => {
            const isActive = selectedStage === st;
            const stageColor = stageColors[st];
            return (
              <button
                key={st}
                onClick={() => setSelectedStage(st)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-tight transition-all uppercase font-mono cursor-pointer flex-1 text-center ${
                  isActive
                    ? "bg-[#18181B] text-[#E4E4E7] border border-zinc-700/80 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
                }`}
                style={isActive ? { borderLeft: `3px solid ${stageColor}` } : {}}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      {durationsData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500 font-mono text-xs border border-dashed border-[#27272A] rounded-xl my-4">
          <Info className="w-6 h-6 text-zinc-600 mb-1.5" />
          <span>No historical profile telemetry recorded for {selectedStage} stage yet.</span>
        </div>
      ) : (
        <div className="my-3 relative">
          <div className="text-[9.5px] uppercase tracking-widest font-mono text-zinc-500 mb-1">
            {stageLabels[selectedStage]}
          </div>
          <div className="bg-[#0A0A0B]/30 border border-[#27272A]/50 rounded-xl p-3 flex items-center justify-center">
            <svg ref={svgRef} className="width-full overflow-visible" style={{ minHeight: "155px" }}></svg>
          </div>
        </div>
      )}

      {/* FOOTER GENERAL LEGEND / SUMMARY */}
      <div className="border-t border-[#27272A]/40 pt-3.5 mt-3 flex items-center justify-between flex-wrap gap-2 text-[9px] font-mono text-zinc-500">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#C5A059]" />
          <span>X: Days in stage // Y: Account count</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#C5A059] opacity-75"></span> Avg Line
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: stageColors[selectedStage] }}></span> Days Bin
          </span>
        </div>
      </div>

      {/* Flowing Floating D3 interactive Tooltip */}
      {hoveredBin && tooltipPos && (
        <div
          className="absolute z-50 pointer-events-none bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-3 shadow-2xl flex flex-col gap-1 text-[11px] font-sans text-[#E4E4E7]"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 70}px`,
            transform: "translate(-50%, -50%)",
            minWidth: "190px",
            maxWidth: "260px",
          }}
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5 mb-1.5">
            <span className="font-bold text-xs uppercase tracking-wide text-white">Range: {hoveredBin.x0.toFixed(0)} - {hoveredBin.x1.toFixed(0)}d</span>
            <span className="text-[9px] font-mono font-bold bg-[#C5A059]/10 text-[#C5A059] border border-[#C5A059]/25 px-1.5 py-0.2 rounded">
              {hoveredBin.count} ACCOUNTS
            </span>
          </div>

          <div className="text-[10px] text-zinc-500 font-mono mb-1">
            Matching CRM Accounts:
          </div>
          
          <div className="space-y-1 max-h-[85px] overflow-y-auto pr-1">
            {hoveredBin.accounts.length === 0 ? (
              <span className="text-zinc-500 italic block text-[10px]">None</span>
            ) : (
              hoveredBin.accounts.map((name, i) => (
                <div key={i} className="flex items-center space-x-1.5 text-[10px] text-zinc-300 font-semibold bg-[#141416] p-1 rounded border border-zinc-800 truncate">
                  <span className="w-1 h-3 rounded-full shrink-0" style={{ backgroundColor: stageColors[selectedStage] }}></span>
                  <span className="truncate">{name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
