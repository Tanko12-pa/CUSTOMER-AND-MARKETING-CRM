import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Customer, LifecycleStage } from "../types";
import { PieChart, Users, Percent, HelpCircle } from "lucide-react";

interface LifecyclePieChartProps {
  customers: Customer[];
  onSelectStage?: (stage: LifecycleStage | null) => void;
  selectedStage?: LifecycleStage | null;
}

export function LifecyclePieChart({ customers, onSelectStage, selectedStage }: LifecyclePieChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoveredData, setHoveredData] = useState<{ stage: string; count: number; percent: number } | null>(null);

  // Define categories in custom logical pipeline order
  const pipelineStages: LifecycleStage[] = ["Lead", "MQL", "SQL", "Customer", "Churned"];

  // Calculate distributions
  const totalCount = customers.length;
  const stageData = pipelineStages.map((stage) => {
    const count = customers.filter((c) => c.lifecycleStage === stage).length;
    const percent = totalCount > 0 ? (count / totalCount) * 100 : 0;
    return { stage, count, percent };
  });

  // Color scheme matching our dark/gold/slate theme
  const colors: Record<LifecycleStage, string> = {
    Lead: "#3B82F6",      // Blue
    MQL: "#8B5CF6",       // Violet / Purple
    SQL: "#F59E0B",       // Gold / Amber
    Customer: "#10B981",  // Emerald
    Churned: "#EF4444",   // Crimson / Red
  };

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 280;
    const height = 280;
    const radius = Math.min(width, height) / 2 - 20;

    // Clear previous SVG contents
    const svgElement = d3.select(svgRef.current);
    svgElement.selectAll("*").remove();

    // Create container group centralized
    const g = svgElement
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // Setup pie and arc generators
    const pie = d3
      .pie<any>()
      .value((d) => d.count)
      .sort(null); // Keep logical pipeline order

    const arc = d3
      .arc<any>()
      .innerRadius(radius * 0.5) // Donut chart look!
      .outerRadius(radius)
      .cornerRadius(6)
      .padAngle(0.04);

    const arcHover = d3
      .arc<any>()
      .innerRadius(radius * 0.45)
      .outerRadius(radius + 8)
      .cornerRadius(8)
      .padAngle(0.02);

    // Filter out zero-count stages to avoid draw clutter but keep logical structure if clicked
    const pathData = pie(stageData);

    // Draw the slices
    const path = g
      .selectAll("path")
      .data(pathData)
      .enter()
      .append("path")
      .attr("d", arc as any)
      .attr("fill", (d) => colors[d.data.stage as LifecycleStage])
      .attr("stroke", "#141416")
      .attr("stroke-width", "3px")
      .style("cursor", "pointer")
      .style("filter", "drop-shadow(0px 4px 12px rgba(0, 0, 0, 0.45))")
      .each(function (d) {
        // Store the initial angles for interpolation on transition
        (this as any)._current = d;
      });

    // Add entry and update animations
    path
      .transition()
      .duration(850)
      .attrTween("d", function (d) {
        const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return function (t) {
          return arc(interpolate(t) as any) as string;
        };
      });

    // Interactive mouse outcomes (scaling the slice, tooltip trigger, legend highlight)
    path
      .on("mouseover", function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("d", arcHover as any)
          .attr("opacity", 1.0);

        setHoveredData({
          stage: d.data.stage,
          count: d.data.count,
          percent: d.data.percent,
        });
      })
      .on("mouseout", function (event, d) {
        const isSelected = selectedStage === d.data.stage;
        d3.select(this)
          .transition()
          .duration(250)
          .attr("d", isSelected ? (arcHover as any) : (arc as any))
          .attr("opacity", selectedStage && !isSelected ? 0.4 : 1.0);

        setHoveredData(null);
      })
      .on("click", function (event, d) {
        const stage = d.data.stage as LifecycleStage;
        if (onSelectStage) {
          if (selectedStage === stage) {
            onSelectStage(null); // Toggle off
          } else {
            onSelectStage(stage); // Select
          }
        }
      });

    // Handle interactive opacity state if a specific stage selection filter is applied
    path.attr("opacity", (d) => {
      if (!selectedStage) return 1.0;
      return d.data.stage === selectedStage ? 1.0 : 0.4;
    });

    // Expand selected stage if there is one
    path.each(function (d) {
      if (selectedStage && d.data.stage === selectedStage) {
        d3.select(this)
          .transition()
          .duration(300)
          .attr("d", arcHover as any);
      }
    });

  }, [customers, selectedStage, stageData]);

  // Handle active status tags
  const activeLabel = hoveredData 
    ? hoveredData 
    : selectedStage 
      ? stageData.find(d => d.stage === selectedStage) 
      : null;

  return (
    <div 
      className="bg-[#141416] border border-[#27272A] rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col h-full justify-between"
      id="pipeline-pie-chart-card"
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#E4E4E7] tracking-tight">Lifecycle Stage Distribution</h3>
              <p className="text-[10px] text-[#A1A1AA] font-mono leading-none mt-0.5">Interactive D3 Pipeline Monitor</p>
            </div>
          </div>
          {onSelectStage && selectedStage && (
            <button 
              onClick={() => onSelectStage(null)}
              className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 font-mono transition-colors cursor-pointer"
            >
              Clear Filter [×]
            </button>
          )}
        </div>

        <p className="text-xs text-[#A1A1AA] leading-relaxed mb-6">
          Distribution of all active CRM records in current datastore context. Hover or click slices/legend to isolate stages dynamically.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center my-auto">
        {/* PIE CHART SVG WRAPPER */}
        <div className="md:col-span-6 flex justify-center relative">
          <svg 
            ref={svgRef} 
            className="w-full max-w-[210px] md:max-w-full drop-shadow-2xl"
            style={{ overflow: "visible" }}
          ></svg>
          
          {/* Donut Center Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {activeLabel ? (
              <div className="text-center animate-fade-in">
                <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500">
                  {activeLabel.stage}
                </span>
                <span className="block text-2xl font-bold text-white leading-none mt-0.5">
                  {activeLabel.count}
                </span>
                <span className="text-[10px] text-[#C5A059] font-mono font-semibold">
                  {activeLabel.percent.toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[9.5px] uppercase tracking-widest font-mono text-zinc-500">
                  Total
                </span>
                <span className="block text-2xl font-bold text-[#E4E4E7] leading-none mt-0.5">
                  {totalCount}
                </span>
                <span className="text-[9px] text-zinc-400 font-mono">
                  Accounts
                </span>
              </div>
            )}
          </div>
        </div>

        {/* INTERACTIVE LEGEND TABLE */}
        <div className="md:col-span-6 space-y-1.5 font-sans">
          {stageData.map(({ stage, count, percent }) => {
            const isSelected = selectedStage === stage;
            const color = colors[stage as LifecycleStage];

            return (
              <div
                key={stage}
                onClick={() => onSelectStage && onSelectStage(isSelected ? null : (stage as LifecycleStage))}
                className={`flex items-center justify-between p-2 rounded-xl transition-all duration-200 cursor-pointer border ${
                  isSelected 
                    ? "bg-[#0A0A0B] border-[#C5A059] shadow-lg translate-x-1" 
                    : selectedStage 
                      ? "opacity-40 hover:opacity-100 bg-[#1A1A1D]/30 border-transparent"
                      : "bg-[#18181B]/50 hover:bg-[#1C1C20] border-transparent hover:translate-x-1"
                }`}
                style={{ direction: "ltr" }}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-inner"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
                  ></span>
                  <span className="text-xs font-bold text-[#E4E4E7] truncate">{stage}</span>
                </div>
                <div className="flex items-center space-x-3 text-right">
                  <span className="text-xs font-mono text-[#A1A1AA]">{count}</span>
                  <span className="text-[10px] font-mono text-[#C5A059] font-semibold w-9 justify-end flex">
                    {percent.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#27272A]/40 pt-4 mt-4 flex items-center justify-between">
        <span className="text-[10px] font-mono text-[#A1A1AA]/60 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Direct client integration active
        </span>
        <span className="text-[10px] font-mono text-[#C5A059] flex items-center gap-1">
          <Percent className="w-3 h-3 text-[#C5A059]" /> Pipeline Distribution
        </span>
      </div>
    </div>
  );
}
