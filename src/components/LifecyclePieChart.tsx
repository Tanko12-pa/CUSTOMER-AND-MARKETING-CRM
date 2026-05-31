import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Customer, LifecycleStage } from "../types";
import { PieChart, Zap, Percent, Download } from "lucide-react";

interface LifecyclePieChartProps {
  customers: Customer[];
  onSelectStage?: (stage: LifecycleStage | null) => void;
  selectedStage?: LifecycleStage | null;
}

export function LifecyclePieChart({ customers, onSelectStage, selectedStage }: LifecyclePieChartProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const velocitySvgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoveredData, setHoveredData] = useState<{ stage: string; count: number; percent: number } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Define categories in custom logical pipeline order
  const pipelineStages: LifecycleStage[] = ["Lead", "MQL", "SQL", "Customer", "Churned"];

  const stageDescriptions: Record<string, string> = {
    Lead: "Early stage contacts showing initial interest or downloaded whitepapers.",
    MQL: "Marketing Qualified Leads with high engagement and matching criteria.",
    SQL: "Sales Qualified Leads vetted directly by reps with active deals in negotiation.",
    Customer: "Paid closed-won contract accounts undergoing active onboarding.",
    Churned: "Inactive or cancelled accounts slated for post-mortem win-back campaigns."
  };

  // Calculate distributions
  const totalCount = customers.length;
  const stageData = useMemo(() => {
    return pipelineStages.map((stage) => {
      const count = customers.filter((c) => c.lifecycleStage === stage).length;
      const percent = totalCount > 0 ? (count / totalCount) * 100 : 0;
      return { stage, count, percent };
    });
  }, [customers, totalCount]);

  // Color scheme matching our dark/gold/slate theme
  const colors: Record<LifecycleStage, string> = {
    Lead: "#3B82F6",      // Blue
    MQL: "#8B5CF6",       // Violet / Purple
    SQL: "#F59E0B",       // Gold / Amber
    Customer: "#10B981",  // Emerald
    Churned: "#EF4444",   // Crimson / Red
  };

  // Browser utility to download D3 SVG state as high-res PNG file with a dark theme background styling
  const handleDownloadPNG = () => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const width = 240;
    const height = 240;

    try {
      // Serialize cloning the active SVG node
      const clone = svgElement.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("width", width.toString());
      clone.setAttribute("height", height.toString());
      clone.style.background = "#141416";
      
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const blobURL = window.URL.createObjectURL(blob);
      
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        // Use double sizing for higher quality density
        canvas.width = width * 2;
        canvas.height = height * 2;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          ctx.scale(2, 2);
          ctx.fillStyle = "#141416";
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(image, 0, 0, width, height);
          
          const pngURL = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngURL;
          downloadLink.download = `crm_lifecycle_distribution_${new Date().toISOString().split("T")[0]}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
        window.URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    } catch (e) {
      console.error("Failed to compile or generate chart image payload:", e);
    }
  };

  // 1. Render Pie Chart
  useEffect(() => {
    if (!svgRef.current) return;

    const width = 240;
    const height = 240;
    const radius = Math.min(width, height) / 2 - 15;

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
      .innerRadius(radius * 0.55) // Donut chart look!
      .outerRadius(radius)
      .cornerRadius(6)
      .padAngle(0.04);

    const arcHover = d3
      .arc<any>()
      .innerRadius(radius * 0.5)
      .outerRadius(radius + 8)
      .cornerRadius(8)
      .padAngle(0.02);

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
      .style("filter", "drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.455))")
      .each(function (d) {
        (this as any)._current = d;
      });

    // Add rich entry transition utilizing d3.interpolate for a beautiful sweep-out layout animation
    path
      .transition()
      .duration(1100)
      .ease(d3.easeExpOut)
      .attrTween("d", function (d) {
        const interpolate = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
        return function (t) {
          return arc(interpolate(t) as any) as string;
        };
      });

    // Interactive mouse outcomes (scaling the slice & tracking cursor coordinates)
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
      .on("mouseleave", function (event, d) {
        const isSelected = selectedStage === d.data.stage;
        d3.select(this)
          .transition()
          .duration(250)
          .attr("d", isSelected ? (arcHover as any) : (arc as any))
          .attr("opacity", selectedStage && !isSelected ? 0.4 : 1.0);

        setHoveredData(null);
        setTooltipPos(null);
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

    // Handle interactive opacity state if filter is applied
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

  // 2. Compute Pipeline Velocity Average Transition Days
  const velocityData = useMemo(() => {
    const transitions = [
      { from: "Lead", to: "MQL", label: "Lead ➔ MQL", color: "#8B5CF6" },
      { from: "MQL", to: "SQL", label: "MQL ➔ SQL", color: "#F59E0B" },
      { from: "SQL", to: "Customer", label: "SQL ➔ Win", color: "#10B981" }
    ];

    return transitions.map(({ from, to, label, color }) => {
      const durations = customers
        .map(c => {
          if (!c.stageHistory) return null;
          const tFrom = c.stageHistory[from as LifecycleStage];
          const tTo = c.stageHistory[to as LifecycleStage];
          if (!tFrom || !tTo) return null;
          const diffDays = (new Date(tTo).getTime() - new Date(tFrom).getTime()) / (1000 * 3600 * 24);
          return Math.max(0.1, diffDays);
        })
        .filter((val): val is number => val !== null);

      const avgDays = durations.length > 0 
        ? durations.reduce((acc, d) => acc + d, 0) / durations.length 
        : 0;

      return {
        label,
        avgDays,
        completedCount: durations.length,
        color
      };
    });
  }, [customers]);

  // 3. Render Pipeline Velocity Chart
  useEffect(() => {
    if (!velocitySvgRef.current) return;

    const width = 380;
    const height = 110;
    const margin = { top: 10, right: 20, bottom: 20, left: 105 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(velocitySvgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scales
    const yScale = d3
      .scaleBand()
      .domain(velocityData.map(d => d.label))
      .range([0, chartHeight])
      .padding(0.3);

    const maxDays = (d3.max(velocityData, (d: any) => d.avgDays) as any) || 10;
    const xScale = d3
      .scaleLinear()
      .domain([0, Math.max(maxDays * 1.15, 1)])
      .range([0, chartWidth]);

    // Draw grid lines
    g.append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(
        d3.axisBottom(xScale)
          .ticks(4)
          .tickSize(-chartHeight)
          .tickFormat(() => "")
      )
      .selectAll(".tick line")
      .attr("stroke", "#27272A")
      .attr("stroke-width", "1px")
      .attr("stroke-dasharray", "2,2");

    // Draw Bars
    const bars = g
      .selectAll(".bar")
      .data(velocityData)
      .enter()
      .append("g")
      .attr("class", "bar-group");

    bars.append("rect")
      .attr("y", (d: any) => yScale(d.label) || 0)
      .attr("x", 0)
      .attr("height", yScale.bandwidth())
      .attr("width", 0)
      .attr("fill", (d: any) => d.color)
      .attr("rx", 3.5)
      .style("filter", (d: any) => `drop-shadow(0 0 6px ${d.color}20)`)
      .transition()
      .duration(700)
      .delay((d: any, i) => i * 120)
      .attr("width", (d: any) => xScale(d.avgDays));

    // Value Labels
    bars.append("text")
      .attr("y", (d: any) => (yScale(d.label) || 0) + yScale.bandwidth() / 2 + 3.5)
      .attr("x", (d: any) => xScale(d.avgDays) + 6)
      .attr("fill", "#E4E4E7")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-weight", "bold")
      .style("opacity", 0)
      .text((d: any) => d.avgDays > 0 ? `${d.avgDays.toFixed(1)}d` : "N/A")
      .transition()
      .duration(350)
      .delay((d: any, i) => i * 120 + 450)
      .style("opacity", 1);

    // Setup Accompanying Axes
    const yAxis = d3.axisLeft(yScale).tickSize(0);
    const yAxisG = g.append("g")
      .call(yAxis);

    yAxisG.selectAll(".tick text")
      .attr("fill", "#A1A1AA")
      .attr("font-size", "9.5px")
      .attr("font-family", "Space Grotesk, sans-serif")
      .attr("font-weight", "500")
      .attr("dx", "-6px");
    yAxisG.select(".domain").remove();

    const xAxis = d3.axisBottom(xScale).ticks(4).tickFormat(d => `${d}d`);
    const xAxisG = g.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xAxis);

    xAxisG.selectAll(".tick text")
      .attr("fill", "#71717A")
      .attr("font-size", "8px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("dy", "6px");
    xAxisG.select(".domain").attr("stroke", "#27272A");
    xAxisG.selectAll(".tick line").attr("stroke", "#27272A");

  }, [velocityData]);

  const activeLabel = hoveredData 
    ? hoveredData 
    : selectedStage 
      ? stageData.find(d => d.stage === selectedStage) 
      : null;

  return (
    <div 
      ref={containerRef}
      className="bg-[#141416] border border-[#27272A]/90 rounded-2xl p-6 shadow-xl relative overflow-visible flex flex-col h-full justify-between"
      id="pipeline-pie-chart-card"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#E4E4E7] tracking-tight">Lifecycle Stage Distribution</h3>
              <p className="text-[10px] text-[#A1A1AA] font-mono leading-none mt-0.5">Interactive D3 Pipeline Monitor</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onSelectStage && selectedStage && (
              <button 
                onClick={() => onSelectStage(null)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 font-mono transition-all cursor-pointer mr-1"
              >
                Clear Filter [×]
              </button>
            )}
            <button
              onClick={handleDownloadPNG}
              className="px-2.5 py-1 rounded-lg bg-[#C5A059]/10 hover:bg-[#C5A059]/15 border border-[#C5A059]/30 text-[10px] text-[#C5A059] font-mono transition-all flex items-center space-x-1 cursor-pointer"
              title="Download Pie Chart as PNG Image"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          Distribution of active CRM profiles. Hover or click slices and legend items to filter stages dynamically.
        </p>
      </div>

      {/* Main distribution grid (Donut + Legend) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center my-4 py-2 border-b border-[#27272A]/40 pb-5">
        {/* DONUT SVG WRAPPER */}
        <div className="md:col-span-6 flex justify-center relative">
          <svg 
            ref={svgRef} 
            className="w-full max-w-[190px] drop-shadow-2xl"
            style={{ overflow: "visible" }}
          ></svg>
          
          {/* Donut Center Display */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {activeLabel ? (
              <div className="text-center animate-fade-in">
                <span className="text-[9px] uppercase tracking-widest font-mono text-zinc-500">
                  {activeLabel.stage}
                </span>
                <span className="block text-xl font-bold text-white leading-none mt-0.5">
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

        {/* INTERACTIVE LEGEND */}
        <div className="md:col-span-6 space-y-1.5 font-sans">
          {stageData.map(({ stage, count, percent }) => {
            const isSelected = selectedStage === stage;
            const color = colors[stage as LifecycleStage];

            return (
              <div
                key={stage}
                onClick={() => onSelectStage && onSelectStage(isSelected ? null : (stage as LifecycleStage))}
                onMouseEnter={(e) => {
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top - 12,
                    });
                  }
                  setHoveredData({ stage, count, percent });
                }}
                onMouseMove={(e) => {
                  if (containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top - 12,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredData(null);
                  setTooltipPos(null);
                }}
                className={`flex items-center justify-between p-2 rounded-xl transition-all duration-200 cursor-pointer border ${
                  isSelected 
                    ? "bg-[#0A0A0B] border-[#C5A059]/75 shadow-lg translate-x-1" 
                    : selectedStage 
                      ? "opacity-40 hover:opacity-100 bg-[#1A1A1D]/30 border-transparent"
                      : "bg-[#18181B]/50 hover:bg-[#1C1C20] border-transparent hover:translate-x-1"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <span 
                    className="w-2 rounded-full shrink-0 h-2"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
                  ></span>
                  <span className="text-xs font-bold text-[#E4E4E7] truncate">{stage}</span>
                </div>
                <div className="flex items-center space-x-3 text-right">
                  <span className="text-xs font-mono text-[#A1A1AA]">{count}</span>
                  <span className="text-[10px] font-mono text-[#C5A059] font-bold w-9 justify-end flex">
                    {percent.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIPELINE VELOCITY CHART SECTION */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-[#C5A059]" />
          <h4 className="text-xs font-bold text-[#E4E4E7] uppercase font-display tracking-wide">
            Pipeline Velocity
          </h4>
          <span className="text-[10px] text-[#A1A1AA] font-mono">(Avg. Conversion Days)</span>
        </div>
        
        <div className="bg-[#0A0A0B]/40 border border-[#27272A]/40 rounded-xl p-2 flex justify-center">
          <svg 
            ref={velocitySvgRef}
            className="w-full max-w-[380px]"
            style={{ overflow: "visible" }}
          ></svg>
        </div>
      </div>

      {/* FOOTER GENERAL SIG */}
      <div className="border-t border-[#27272A]/40 pt-3.5 mt-4 flex items-center justify-between">
        <span className="text-[9px] font-mono text-[#A1A1AA]/60 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Telemetry analytics synchronized
        </span>
        <span className="text-[9px] font-mono text-[#C5A059] flex items-center gap-1">
          <Percent className="w-2.5 h-2.5" /> Pipeline Analytics
        </span>
      </div>

      {/* Rich Floating absolute HTML Tooltip */}
      {hoveredData && tooltipPos && (
        <div 
          className="absolute z-40 pointer-events-none bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 shadow-2xl flex flex-col gap-1 text-[11px] font-sans text-[#E4E4E7] transition-all duration-75"
          style={{ 
            left: `${tooltipPos.x}px`, 
            top: `${tooltipPos.y - 75}px`,
            transform: "translate(-50%, -50%)",
            minWidth: "160px"
          }}
        >
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-1.5 mb-1.5">
            <span className="font-bold text-xs uppercase tracking-wide text-white">{hoveredData.stage}</span>
            <span className="text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/25">
              {hoveredData.percent.toFixed(0)}% SHARE
            </span>
          </div>
          
          <div className="flex items-center justify-between font-mono mb-1">
            <span className="text-zinc-500 text-[10px]">Volume:</span>
            <span className="font-bold text-white">{hoveredData.count} Accounts</span>
          </div>

          <p className="text-[10px] text-zinc-400 font-sans leading-relaxed border-t border-zinc-900 pt-1">
            {stageDescriptions[hoveredData.stage]}
          </p>
        </div>
      )}
    </div>
  );
}
