"use client";

import React from "react";
import { analyzeMarkdownStructure, type StructureAnalysis } from "@/lib/structure-analyzer";

type StructurePanelProps = {
    markdown: string;
    className?: string;
};

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);

const XCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>
);

const AlertCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
);

const InfoIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
);

const SparklesIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
    </svg>
);

export function StructurePanel({ markdown, className = "" }: StructurePanelProps) {
    const analysis: StructureAnalysis = React.useMemo(
        () => analyzeMarkdownStructure(markdown),
        [markdown]
    );

    const { sections, metrics, health, warnings, aiReadability } = analysis;

    const healthColorClasses = {
        emerald: {
            bg: "bg-emerald-50",
            border: "border-emerald-200",
            text: "text-emerald-700",
            badge: "bg-emerald-100",
            ring: "ring-emerald-500/20",
        },
        blue: {
            bg: "bg-blue-50",
            border: "border-blue-200",
            text: "text-blue-700",
            badge: "bg-blue-100",
            ring: "ring-blue-500/20",
        },
        amber: {
            bg: "bg-amber-50",
            border: "border-amber-200",
            text: "text-amber-700",
            badge: "bg-amber-100",
            ring: "ring-amber-500/20",
        },
        red: {
            bg: "bg-red-50",
            border: "border-red-200",
            text: "text-red-700",
            badge: "bg-red-100",
            ring: "ring-red-500/20",
        },
    };

    const colors = healthColorClasses[health.color as keyof typeof healthColorClasses] || healthColorClasses.blue;

    return (
        <div className={`space-y-4 ${className}`}>
            {/* AI Readability Score */}
            <div className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-6 shadow-sm ring-4 ${colors.ring}`}>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${colors.badge}`}>
                            <SparklesIcon className={`w-6 h-6 ${colors.text}`} />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${colors.text}`}>AI Readability</h3>
                            <p className="text-sm text-slate-600">Structure verification for AI consumption</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-3xl font-extrabold ${colors.text}`}>{health.score}</div>
                        <div className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>{health.grade}</div>
                    </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{health.description}</p>
            </div>

            {/* Section Checklist */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    MDF Structure Checklist
                </h4>
                <div className="space-y-2">
                    <SectionCheckItem label="Title (H1)" checked={sections.hasTitle} tooltip="Main heading helps AI identify the topic" />
                    <SectionCheckItem label="Frontmatter" checked={sections.hasFrontmatter} tooltip="Structured metadata at the top" />
                    <SectionCheckItem label="Source URL" checked={sections.hasUrl} tooltip="Original page reference for verification" />
                    <SectionCheckItem label="Content Body" checked={sections.hasContent} tooltip="Main article content" />
                    <SectionCheckItem label="Metadata" checked={sections.hasMetadata} tooltip="Author, date, language information" />
                </div>
            </div>

            {/* Content Metrics */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-slate-400">
                        <line x1="12" y1="20" x2="12" y2="10"></line>
                        <line x1="18" y1="20" x2="18" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="16"></line>
                    </svg>
                    Content Metrics
                </h4>
                <div className="grid grid-cols-2 gap-3">
                    <MetricCard label="Words" value={metrics.wordCount} icon="📝" />
                    <MetricCard label="Paragraphs" value={metrics.paragraphCount} icon="¶" />
                    <MetricCard label="Headings" value={metrics.headingCount} icon="#" />
                    <MetricCard label="Lists" value={metrics.listCount} icon="•" />
                    <MetricCard label="Code Blocks" value={metrics.codeBlockCount} icon="</>" />
                    <MetricCard label="Links" value={metrics.linkCount} icon="🔗" />
                </div>
            </div>

            {/* AI Readability Details */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h4 className="text-sm font-bold text-slate-900 mb-3">AI Understanding Analysis</h4>

                {aiReadability.strengths.length > 0 && (
                    <div className="mb-4">
                        <div className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Strengths
                        </div>
                        <ul className="space-y-1">
                            {aiReadability.strengths.map((strength, i) => (
                                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                    <span className="text-emerald-500 mt-0.5">✓</span>
                                    <span>{strength}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {aiReadability.issues.length > 0 && (
                    <div>
                        <div className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1">
                            <AlertCircleIcon className="w-3.5 h-3.5" />
                            Improvement Areas
                        </div>
                        <ul className="space-y-1">
                            {aiReadability.issues.map((issue, i) => (
                                <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                    <span className="text-amber-500 mt-0.5">!</span>
                                    <span>{issue}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Validation Warnings */}
            {warnings.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-900 mb-3">Validation Warnings</h4>
                    <div className="space-y-2">
                        {warnings.map((warning, i) => (
                            <ValidationWarning key={i} warning={warning} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SectionCheckItem({ label, checked, tooltip }: { label: string; checked: boolean; tooltip: string }) {
    return (
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors group">
            <div className="flex items-center gap-2">
                {checked ? (
                    <CheckCircleIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                ) : (
                    <XCircleIcon className="w-4 h-4 text-slate-300 flex-shrink-0" />
                )}
                <span className={`text-sm font-medium ${checked ? "text-slate-700" : "text-slate-400"}`}>
                    {label}
                </span>
            </div>
            <div className="relative group/tooltip">
                <InfoIcon className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-slate-900 text-white text-xs rounded-lg p-2 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-10 pointer-events-none">
                    {tooltip}
                    <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900"></div>
                </div>
            </div>
        </div>
    );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: string }) {
    return (
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <span className="text-sm">{icon}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{value}</div>
        </div>
    );
}

function ValidationWarning({ warning }: { warning: { severity: string; message: string; section?: string } }) {
    const severityConfig = {
        error: {
            icon: <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />,
            bg: "bg-red-50",
            border: "border-red-200",
            text: "text-red-700",
        },
        warning: {
            icon: <AlertCircleIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />,
            bg: "bg-amber-50",
            border: "border-amber-200",
            text: "text-amber-700",
        },
        info: {
            icon: <InfoIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />,
            bg: "bg-blue-50",
            border: "border-blue-200",
            text: "text-blue-700",
        },
    };

    const config = severityConfig[warning.severity as keyof typeof severityConfig] || severityConfig.info;

    return (
        <div className={`flex items-start gap-2 p-3 rounded-lg border ${config.border} ${config.bg}`}>
            {config.icon}
            <div className="flex-1">
                {warning.section && (
                    <div className={`text-xs font-bold uppercase tracking-wider ${config.text} mb-0.5`}>
                        {warning.section}
                    </div>
                )}
                <p className={`text-sm ${config.text}`}>{warning.message}</p>
            </div>
        </div>
    );
}
