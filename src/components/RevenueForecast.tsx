import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Customer } from "../types";
import { TrendingUp, Award, Clock, DollarSign } from "lucide-react";

interface RevenueForecastProps {
  customer: Customer | null | undefined;
}

interface ChartDataPoint {
  month: string;
  ltv: number;
  type: "historic" | "projected";
  index: number;
}

export const RevenueForecast: React.FC<RevenueForecastProps> = ({ customer }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 280 });
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Handle responsiveness via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 300),
          height: 250,
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute historic and projected data
  const { allPoints, stats } = useMemo(() => {
    if (!customer) {
      return { allPoints: [], stats: null };
    }

    const currentLtv = customer.lifetimeValue || 0;

    // Use stored growth trends from Firestore, or fall back to progressive values if not present
    const rawTrends = customer.growthTrends && customer.growthTrends.length > 0
      ? customer.growthTrends
      : [
          { month: "Dec", ltv: currentLtv * 0.4 },
          { month: "Jan", ltv: currentLtv * 0.55 },
          { month: "Feb", ltv: currentLtv * 0.75 },
          { month: "Mar", ltv: currentLtv * 0.85 },
          { month: "Apr", ltv: currentLtv * 0.92 },
          { month: "May", ltv: currentLtv }
        ];

    // Convert to ChartDataPoint structure
    const historicPoints: ChartDataPoint[] = rawTrends.map((t, idx) => ({
      month: t.month,
      ltv: t.ltv,
      type: "historic",
      index: idx
    }));

    // Calculate growth trajectory rate (average increment per month)
    let monthlyGrowthRate = 0;
    if (historicPoints.length >= 2) {
      const firstVal = historicPoints[0].ltv;
      const lastVal = historicPoints[historicPoints.length - 1].ltv;
      monthlyGrowthRate = (lastVal - firstVal) / (historicPoints.length - 1);
    }

    // Graceful baseline factor based on account premium tier if growth is stalled or non-existent
    if (monthlyGrowthRate <= 0) {
      if (customer.tier === "Enterprise") {
        monthlyGrowthRate = 8500;
      } else if (customer.tier === "Premium") {
        monthlyGrowthRate = 3500;
      } else {
        monthlyGrowthRate = 600;
      }
    }

    // Project future LTV for the next 6 months (June - November)
    const projectedMonths = ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"];
    const projectedPoints: ChartDataPoint[] = projectedMonths.map((month, idx) => {
      const projectedLtv = currentLtv + (idx + 1) * monthlyGrowthRate;
      return {
        month,
        ltv: projectedLtv,
        type: "projected",
        index: historicPoints.length + idx
      };
    });

    const combinedPoints = [...historicPoints, ...projectedPoints];

    const sixMonthProj = projectedPoints[projectedPoints.length - 1].ltv;
    const projectedTotalIncrease = sixMonthProj - currentLtv;
    const monthlyRate = monthlyGrowthRate;

    return {
      allPoints: combinedPoints,
      stats: {
        sixMonthForecast: sixMonthProj,
        projectedIncrease: projectedTotalIncrease,
        growthRate: monthlyRate
      }
    };
  }, [customer]);

  // Handle D3 Chart Rendering
  useEffect(() => {
    if (!svgRef.current || allPoints.length === 0 || !customer) return;

    const margin = { top: 20, right: 25, bottom: 35, left: 55 };
    const width = dimensions.width;
    const height = dimensions.height;
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clean canvas

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Define Scales
    const xScale = d3.scaleLinear()
      .domain([0, d3.max(allPoints, (d: ChartDataPoint) => d.index) || 11])
      .range([0, chartWidth]);

    const maxLtv = d3.max(allPoints, (d: ChartDataPoint) => d.ltv) || 1000;
    const yScale = d3.scaleLinear()
      .domain([0, maxLtv * 1.15]) // 15% buffer space at the top
      .range([chartHeight, 0]);

    // Build SVG Gradients
    const defs = svg.append("defs");

    // Golden gradient for past trends
    const pastGrad = defs.append("linearGradient")
      .attr("id", "past-ltv-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    pastGrad.append("stop").attr("offset", "0%").attr("stop-color", "#C5A059").attr("stop-opacity", 0.18);
    pastGrad.append("stop").attr("offset", "100%").attr("stop-color", "#C5A059").attr("stop-opacity", 0.0);

    // Emerald gradient for projections
    const futGrad = defs.append("linearGradient")
      .attr("id", "fut-ltv-grad")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    futGrad.append("stop").attr("offset", "0%").attr("stop-color", "#10B981").attr("stop-opacity", 0.18);
    futGrad.append("stop").attr("offset", "100%").attr("stop-color", "#10B981").attr("stop-opacity", 0.0);

    // Gridlines
    g.append("g")
      .attr("class", "grid")
      .attr("stroke", "#27272A")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-dasharray", "2,2")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(d3.axisBottom(xScale)
        .ticks(allPoints.length)
        .tickSize(-chartHeight)
        .tickFormat(() => "")
      );

    g.append("g")
      .attr("class", "grid")
      .attr("stroke", "#27272A")
      .attr("stroke-opacity", 0.15)
      .attr("stroke-dasharray", "2,2")
      .call(d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(-chartWidth)
        .tickFormat(() => "")
      );

    // Split Line segments to anchor perfectly at the joint event (Month May, ending historic)
    const historicSegment = allPoints.filter(p => p.type === "historic");
    const projectedSegment = allPoints.filter(p => {
      // Anchoring joint
      const lastHistoric = allPoints.find(hp => hp.type === "historic" && hp.index === historicSegment.length - 1);
      return p.type === "projected" || (lastHistoric && p.index === lastHistoric.index);
    });

    // Area generators
    const areaGenerator = d3.area<ChartDataPoint>()
      .x(d => xScale(d.index))
      .y0(chartHeight)
      .y1(d => yScale(d.ltv))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(historicSegment)
      .attr("d", areaGenerator)
      .attr("fill", "url(#past-ltv-grad)");

    g.append("path")
      .datum(projectedSegment)
      .attr("d", areaGenerator)
      .attr("fill", "url(#fut-ltv-grad)");

    // Line generator
    const lineGenerator = d3.line<ChartDataPoint>()
      .x(d => xScale(d.index))
      .y(d => yScale(d.ltv))
      .curve(d3.curveMonotoneX);

    // Draw historic line (Gold, solid)
    g.append("path")
      .datum(historicSegment)
      .attr("fill", "none")
      .attr("stroke", "#C5A059")
      .attr("stroke-width", 2.5)
      .attr("d", lineGenerator);

    // Draw forecast line (Projected, Emerald, dashed)
    g.append("path")
      .datum(projectedSegment)
      .attr("fill", "none")
      .attr("stroke", "#10B981")
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "4,4")
      .attr("d", lineGenerator);

    // Draw past nodes
    g.selectAll(".dot-past")
      .data(historicSegment)
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale((d as ChartDataPoint).index))
      .attr("cy", (d) => yScale((d as ChartDataPoint).ltv))
      .attr("r", 3.5)
      .attr("fill", "#141416")
      .attr("stroke", "#C5A059")
      .attr("stroke-width", 1.8);

    // Draw future projections nodes (except the joint anchor to avoid duplicate rings)
    g.selectAll(".dot-future")
      .data(allPoints.filter(p => p.type === "projected"))
      .enter()
      .append("circle")
      .attr("cx", (d) => xScale((d as ChartDataPoint).index))
      .attr("cy", (d) => yScale((d as ChartDataPoint).ltv))
      .attr("r", 3.5)
      .attr("fill", "#141416")
      .attr("stroke", "#10B981")
      .attr("stroke-width", 1.8);

    // Build Axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(allPoints.length)
      .tickFormat((d) => {
        const p = allPoints.find(pt => pt.index === Number(d));
        return p ? p.month : "";
      });

    const yAxis = d3.axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => {
        const val = Number(d);
        if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
        return `$${val}`;
      });

    // Render X Axis
    const xAxisG = g.append("g")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(xAxis);

    xAxisG.selectAll(".tick text")
      .attr("fill", "#71717A")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("dy", "10px");
    xAxisG.select(".domain").attr("stroke", "#27272A");
    xAxisG.selectAll(".tick line").attr("stroke", "#27272A");

    // Render Y Axis
    const yAxisG = g.append("g")
      .call(yAxis);

    yAxisG.selectAll(".tick text")
      .attr("fill", "#71717A")
      .attr("font-size", "9px")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("dx", "-4px");
    yAxisG.select(".domain").attr("stroke", "#27272A");
    yAxisG.selectAll(".tick line").attr("stroke", "#27272A");

    // Elements for hover triggers
    const trackerLine = g.append("line")
      .style("stroke", "#27272A")
      .style("stroke-width", "1px")
      .style("stroke-dasharray", "3,3")
      .attr("y1", 0)
      .attr("y2", chartHeight)
      .style("opacity", 0);

    const trackerDot = g.append("circle")
      .attr("r", 6)
      .style("stroke", "#ffffff")
      .style("stroke-width", "2px")
      .style("opacity", 0);

    // Interactive mouse trackers
    svg.on("mousemove", (event) => {
      const [mouseX] = d3.pointer(event);
      const relativeX = mouseX - margin.left;

      if (relativeX >= 0 && relativeX <= chartWidth) {
        const indexApprox = xScale.invert(relativeX);
        const closestIdx = Math.max(0, Math.min(allPoints.length - 1, Math.round(indexApprox)));
        const point = allPoints.find(p => p.index === closestIdx);

        if (point) {
          setHoveredPoint(point);
          setTooltipPos({
            x: xScale(point.index) + margin.left,
            y: yScale(point.ltv) + margin.top
          });

          trackerLine
            .attr("x1", xScale(point.index))
            .attr("x2", xScale(point.index))
            .style("opacity", 0.7);

          trackerDot
            .attr("cx", xScale(point.index))
            .attr("cy", yScale(point.ltv))
            .style("fill", point.type === "historic" ? "#C5A059" : "#10B981")
            .style("opacity", 1);
        }
      }
    });

    svg.on("mouseleave", () => {
      setHoveredPoint(null);
      trackerLine.style("opacity", 0);
      trackerDot.style("opacity", 0);
    });

  }, [allPoints, dimensions, customer]);

  if (!customer) {
    return (
      <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] flex flex-col items-center justify-center py-12 text-center text-zinc-500">
        <TrendingUp className="w-8 h-8 text-zinc-700 mb-2 animate-pulse" />
        <span className="text-xs font-mono">Select a premium/enterprise client from the CRM table to review forecasting trends.</span>
      </div>
    );
  }

  return (
    <div className="bg-[#141416] rounded-2xl p-6 shadow-xl border border-[#27272A] space-y-5" id="prospect-tv-revenue-forecast-card">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#27272A] pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-[#E4E4E7] uppercase font-display tracking-tight">
              Customer Lifetime Value Forecast (LTV)
            </h3>
          </div>
          <p className="text-[11px] text-[#A1A1AA] font-sans">
            Linear extrapolation model showing monthly target growth and future customer valuation boundaries.
          </p>
        </div>

        {/* Legend block */}
        <div className="flex items-center space-x-4 font-mono text-[9px] shrink-0">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-1.5 rounded-sm bg-[#C5A059]"></span>
            <span className="text-zinc-400">HISTORIC GROWTH</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-1.5 rounded-sm bg-emerald-500 border border-dashed border-emerald-300"></span>
            <span className="text-zinc-400">PROJECTED VALUE</span>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#0A0A0B] p-4 rounded-xl border border-[#27272A]/70 text-xs">
          <div className="space-y-1 font-sans">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">Current LTV Value</span>
            <div className="text-white font-bold text-base flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-[#C5A059]" />
              {(customer.lifetimeValue || 0).toLocaleString()}
            </div>
          </div>
          <div className="space-y-1 font-sans">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">Growth Pace</span>
            <div className="text-white font-bold text-base flex items-center gap-0.5">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              {Math.round(stats.growthRate).toLocaleString()}<span className="text-[10px] text-zinc-500 font-medium">/mo</span>
            </div>
          </div>
          <div className="space-y-1 font-sans">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">6-Month LTV Peak</span>
            <div className="text-white font-bold text-base flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              {Math.round(stats.sixMonthForecast).toLocaleString()}
            </div>
          </div>
          <div className="space-y-1 font-sans">
            <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">Total Projected Delta</span>
            <div className="text-emerald-400 font-bold text-base flex items-center gap-0.5">
              +{Math.round((stats.projectedIncrease / (customer.lifetimeValue || 1)) * 100)}%
              <span className="text-[10px] text-emerald-500 font-medium font-mono"> (+${Math.round(stats.projectedIncrease).toLocaleString()})</span>
            </div>
          </div>
        </div>
      )}

      {/* Responsive D3 Graph Container */}
      <div 
        ref={containerRef} 
        className="relative bg-[#0A0A0B]/65 border border-[#27272A]/40 rounded-xl overflow-visible p-1 pt-3"
      >
        <svg 
          ref={svgRef} 
          width={dimensions.width} 
          height={dimensions.height}
          className="overflow-visible block mx-auto"
        />

        {/* Floating HTML Rich Tooltip */}
        {hoveredPoint && (
          <div 
            className="absolute z-30 pointer-events-none bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 shadow-2xl flex flex-col gap-1 text-[11px] font-sans text-[#E4E4E7]"
            style={{ 
              left: `${tooltipPos.x}px`, 
              top: `${tooltipPos.y - 85}px`,
              transform: "translate(-50%, -50%)",
              minWidth: "150px"
            }}
          >
            <div className="flex items-center justify-between border-b border-zinc-800/60 pb-1.5 mb-1.5">
              <span className="font-bold text-xs uppercase tracking-wide text-white">{hoveredPoint.month} 2026</span>
              <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.2 rounded border ${
                hoveredPoint.type === "historic" 
                  ? "bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/25" 
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
              }`}>
                {hoveredPoint.type}
              </span>
            </div>
            
            <div className="flex items-center justify-between font-mono">
              <span className="text-zinc-500 text-[10px]">Valuation:</span>
              <span className="font-bold text-white">${Math.round(hoveredPoint.ltv).toLocaleString()}</span>
            </div>

            {hoveredPoint.type === "projected" && (
              <div className="flex items-center justify-between font-mono border-t border-zinc-800/30 pt-1 mt-1 text-[9px] text-emerald-500">
                <span>Increment:</span>
                <span>+${Math.round(hoveredPoint.ltv - customer.lifetimeValue).toLocaleString()}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
