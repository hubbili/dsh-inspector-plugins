/** Stable class names and plugin-owned stylesheet for the raw capture view. */

export const classes = {
  root: 'llmWireDebugRoot',
  warning: 'llmWireDebugWarning',
  body: 'llmWireDebugBody',
  list: 'llmWireDebugList',
  listHeader: 'llmWireDebugListHeader',
  listIntro: 'llmWireDebugListIntro',
  guide: 'llmWireDebugGuide',
  guideSteps: 'llmWireDebugGuideSteps',
  guideStep: 'llmWireDebugGuideStep',
  guideActive: 'llmWireDebugGuideActive',
  filter: 'llmWireDebugFilter',
  count: 'llmWireDebugCount',
  traceIdentifier: 'llmWireDebugTraceIdentifier',
  traceHeader: 'llmWireDebugTraceHeader',
  groupBar: 'llmWireDebugGroupBar',
  group: 'llmWireDebugGroup',
  groupActive: 'llmWireDebugGroupActive',
  help: 'llmWireDebugHelp',
  fileHeading: 'llmWireDebugFileHeading',
  source: 'llmWireDebugSource',
  sourceEntry: 'llmWireDebugSourceEntry',
  translationWarning: 'llmWireDebugTranslationWarning',
  readerControls: 'llmWireDebugReaderControls',
  readerModeToggle: 'llmWireDebugReaderModeToggle',
  fileScroller: 'llmWireDebugFileScroller',
  reader: 'llmWireDebugReader',
  readerCard: 'llmWireDebugReaderCard',
  readerSummary: 'llmWireDebugReaderSummary',
  readerSection: 'llmWireDebugReaderSection',
  readerText: 'llmWireDebugReaderText',
  readerJson: 'llmWireDebugReaderJson',
  readerBlocks: 'llmWireDebugReaderBlocks',
  readerFold: 'llmWireDebugReaderFold',
  readerHint: 'llmWireDebugReaderHint',
  readerDescription: 'llmWireDebugReaderDescription',
  readerIndex: 'llmWireDebugReaderIndex',
  role: 'llmWireDebugRole',
  roleSystem: 'llmWireDebugRoleSystem',
  roleUser: 'llmWireDebugRoleUser',
  roleAssistant: 'llmWireDebugRoleAssistant',
  roleTool: 'llmWireDebugRoleTool',
  artifactBar: 'llmWireDebugArtifactBar',
  traceList: 'llmWireDebugTraceList',
  content: 'llmWireDebugContent',
  trace: 'llmWireDebugTrace',
  traceActive: 'llmWireDebugTraceActive',
  artifact: 'llmWireDebugArtifact',
  artifactActive: 'llmWireDebugArtifactActive',
  button: 'llmWireDebugButton',
  traceNumber: 'llmWireDebugTraceNumber',
  traceTime: 'llmWireDebugTraceTime',
  traceState: 'llmWireDebugTraceState',
  liveStatus: 'llmWireDebugLiveStatus',
  liveDot: 'llmWireDebugLiveDot',
  live_connected: 'llmWireDebugLiveConnected',
  live_connecting: 'llmWireDebugLiveConnecting',
  live_reconnecting: 'llmWireDebugLiveReconnecting',
  artifactTabs: 'llmWireDebugArtifactTabs',
  raw: 'llmWireDebugRaw',
  empty: 'llmWireDebugEmpty',
  error: 'llmWireDebugError',
} as const

export const styleText = String.raw`
.llmWireDebugRoot{--llm-wire-bottom-clearance:calc(var(--dsh-composer-height,150px) + 16px);display:flex;flex:1;flex-direction:column;width:100%;height:100%;min-height:0;overflow:hidden;box-sizing:border-box;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
.llmWireDebugWarning{flex:none;padding:8px 16px;border-bottom:1px solid var(--dsw-alias-state-warn-secondary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-state-warn-tertiary);font-size:12px;line-height:18px}
.llmWireDebugBody{display:grid;grid-template-columns:minmax(260px,26%) minmax(0,1fr);flex:1;min-height:0;overflow:hidden}
.llmWireDebugList{display:flex;flex-direction:column;min-width:0;min-height:0;border-right:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2)}
.llmWireDebugListHeader,.llmWireDebugArtifactBar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:0 12px;border-bottom:.5px solid var(--dsw-alias-border-l3)}
.llmWireDebugLiveStatus{display:inline-flex;align-items:center;gap:5px;margin-left:auto;color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}.llmWireDebugLiveDot{width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.llmWireDebugLiveConnected .llmWireDebugLiveDot{background:#12b76a}.llmWireDebugLiveConnecting .llmWireDebugLiveDot,.llmWireDebugLiveReconnecting .llmWireDebugLiveDot{background:#f79009}
.llmWireDebugTraceList{min-height:0;overflow:auto}
.llmWireDebugTraceList{display:flex;flex:1;flex-direction:column;padding:8px;padding-bottom:var(--llm-wire-bottom-clearance);gap:4px;scroll-padding-bottom:var(--llm-wire-bottom-clearance)}
.llmWireDebugTrace,.llmWireDebugTraceActive,.llmWireDebugArtifact,.llmWireDebugArtifactActive,.llmWireDebugButton{border:0;border-radius:6px;color:inherit;background:transparent;font:inherit;cursor:pointer}
.llmWireDebugTrace,.llmWireDebugTraceActive{display:flex;flex-direction:column;align-items:flex-start;gap:5px;width:100%;padding:10px;text-align:left;border:1px solid transparent}
.llmWireDebugTrace:hover,.llmWireDebugArtifact:hover,.llmWireDebugButton:hover{background:var(--dsw-alias-interactive-bg-hover)}
.llmWireDebugTraceActive,.llmWireDebugArtifactActive{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-module-platform)}
.llmWireDebugTraceActive{border-color:var(--dsw-alias-border-l2)}
.llmWireDebugTraceNumber{color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code);font-size:11px}
.llmWireDebugTraceTime{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.llmWireDebugTraceState{grid-column:2;color:var(--dsw-alias-label-secondary);font-size:11px}
.llmWireDebugContent{display:flex;flex-direction:column;min-height:0;overflow:hidden;box-sizing:border-box}
.llmWireDebugFileScroller{flex:1;min-width:0;min-height:0;overflow:auto;padding-bottom:var(--llm-wire-bottom-clearance);scroll-padding-bottom:var(--llm-wire-bottom-clearance);box-sizing:border-box}
.llmWireDebugArtifactBar{flex:none;padding-left:8px}
.llmWireDebugArtifactTabs{display:flex;flex:1;align-items:center;gap:2px;min-width:0;overflow-x:auto}
.llmWireDebugArtifact,.llmWireDebugArtifactActive,.llmWireDebugButton{flex:none;padding:6px 9px;font-size:12px;line-height:18px}
.llmWireDebugButton{border:.5px solid var(--dsw-alias-border-l2)}
.llmWireDebugButton:disabled{cursor:default;opacity:.5}
.llmWireDebugGuide{flex:none;padding:12px 16px;border-bottom:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);font-size:13px;line-height:1.5}
.llmWireDebugGuide p{margin:4px 0 9px;color:var(--dsw-alias-label-secondary);font-size:12px}
.llmWireDebugGuideSteps{display:flex;gap:8px;flex-wrap:wrap}
.llmWireDebugGuideStep,.llmWireDebugGuideActive{padding:6px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.llmWireDebugGuideActive{background:var(--dsw-alias-bg-module-platform);font-weight:600}
.llmWireDebugGuideStep:disabled{opacity:.45;cursor:default}
.llmWireDebugListIntro{flex:none;padding:12px;border-bottom:.5px solid var(--dsw-alias-border-l3);font-size:11px;line-height:1.6}
.llmWireDebugListIntro p{margin:5px 0 10px;color:var(--dsw-alias-label-secondary)}
.llmWireDebugFilter{box-sizing:border-box;width:100%;padding:7px 9px;border:.5px solid var(--dsw-alias-border-l2);border-radius:6px;color:inherit;background:var(--dsw-alias-bg-layer-1);font:inherit;font-size:12px}
.llmWireDebugCount{display:block;margin-top:7px;color:var(--dsw-alias-label-secondary)}
.llmWireDebugTraceIdentifier{display:block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code);font-size:10px}
.llmWireDebugTraceHeader{display:flex;flex:none;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:.5px solid var(--dsw-alias-border-l3);font-size:11px;color:var(--dsw-alias-label-secondary)}
.llmWireDebugTraceHeader code{min-width:0;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);font-size:11px}
.llmWireDebugTraceHeader time{margin-left:auto;white-space:nowrap}
.llmWireDebugGroupBar{display:flex;flex:none;gap:4px;flex-wrap:wrap;padding:8px 12px;border-bottom:.5px solid var(--dsw-alias-border-l3)}
.llmWireDebugGroup,.llmWireDebugGroupActive{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.llmWireDebugGroupActive{background:var(--dsw-alias-bg-module-platform);font-weight:600}
.llmWireDebugGroup span,.llmWireDebugGroupActive span{font-size:10px;color:var(--dsw-alias-label-secondary)}
.llmWireDebugGroup:disabled{opacity:.45;cursor:default}
.llmWireDebugHelp{flex:none;padding:9px 16px;border-bottom:.5px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-bg-layer-2);font-size:12px;line-height:1.55}
.llmWireDebugFileHeading{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;font-size:11px}.llmWireDebugFileHeading code{white-space:nowrap}.llmWireDebugFileHeading span{color:var(--dsw-alias-label-secondary)}
.llmWireDebugHelp dl{display:flex;flex-direction:column;gap:5px;margin:0}
.llmWireDebugHelp dl>div{display:grid;grid-template-columns:76px minmax(0,1fr);gap:10px}
.llmWireDebugHelp dt{color:var(--dsw-alias-label-secondary)}
.llmWireDebugHelp dd{margin:0;overflow-wrap:anywhere}
.llmWireDebugSource{margin-top:6px;color:var(--dsw-alias-label-secondary);font-size:11px}.llmWireDebugSource dl{margin-top:9px}
.llmWireDebugSource summary{cursor:pointer}
.llmWireDebugSource p{margin:6px 0}
.llmWireDebugSourceEntry{margin-top:8px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l3)}
.llmWireDebugSourceEntry>div{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.llmWireDebugSource code{display:block;overflow-wrap:anywhere;margin:5px 0;font-size:11px}
.llmWireDebugTranslationWarning{margin:10px 0 0;padding:7px 9px;border-radius:5px;background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-label-primary)}
.llmWireDebugReaderModeToggle{display:flex;flex:none;gap:2px}
.llmWireDebugReaderControls{padding:6px 16px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.llmWireDebugReaderControls p{margin:0;line-height:1.5}
.llmWireDebugReader{padding:8px 16px 12px;font-size:12px;line-height:1.6}
.llmWireDebugReaderCard{margin-bottom:10px;padding:12px;border:.5px solid var(--dsw-alias-border-l3);border-radius:8px;background:var(--dsw-alias-bg-layer-2)}
.llmWireDebugReader h3{margin:0 0 8px;font-size:13px;font-weight:600}.llmWireDebugReader h4{display:flex;align-items:center;gap:8px;margin:0 0 8px;font-size:12px;font-weight:500}
.llmWireDebugReaderSummary{display:flex;gap:16px;flex-wrap:wrap;margin:0}.llmWireDebugReaderSummary>div{display:flex;align-items:center;gap:6px}.llmWireDebugReaderSummary dt{color:var(--dsw-alias-label-secondary)}.llmWireDebugReaderSummary dd{margin:0;overflow-wrap:anywhere}
.llmWireDebugReaderSection{margin:16px 0}
.llmWireDebugReaderText,.llmWireDebugReaderJson{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--ds-font-family-code);font-size:12px;line-height:1.7}
.llmWireDebugReaderJson{font-size:11px;padding:8px;border-radius:5px;background:var(--dsw-alias-bg-layer-1)}
.llmWireDebugReaderFold{margin:8px 0;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l3);border-radius:6px}.llmWireDebugReaderFold summary{cursor:pointer;color:var(--dsw-alias-label-secondary)}
.llmWireDebugReaderHint{margin:5px 0 8px;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.5}.llmWireDebugReaderDescription{white-space:pre-wrap;overflow-wrap:anywhere}
.llmWireDebugReaderIndex{margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:10px}
.llmWireDebugRole,.llmWireDebugRoleSystem,.llmWireDebugRoleUser,.llmWireDebugRoleAssistant,.llmWireDebugRoleTool{padding:2px 7px;border-radius:4px;font-size:11px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary)}
.llmWireDebugRoleSystem{color:#a78bfa;background:rgba(139,92,246,.12)}
.llmWireDebugRoleUser{color:#34d399;background:rgba(16,185,129,.12)}.llmWireDebugRoleAssistant{color:#60a5fa;background:rgba(59,130,246,.12)}.llmWireDebugRoleTool{color:#fbbf24;background:rgba(245,158,11,.12)}
.llmWireDebugRaw{min-width:0;margin:0;padding:16px;white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2;font-family:var(--ds-font-family-code);font-size:12px;line-height:1.55}
.llmWireDebugEmpty,.llmWireDebugError{margin:auto;padding:24px;color:var(--dsw-alias-label-secondary);font-size:13px;text-align:center}
.llmWireDebugError{color:var(--dsw-alias-state-error-primary)}
@media(max-width:720px){.llmWireDebugBody{grid-template-columns:1fr;grid-template-rows:280px minmax(430px,1fr);overflow:auto}.llmWireDebugList{border-right:0;border-bottom:.5px solid var(--dsw-alias-border-l3)}.llmWireDebugListIntro p{display:none}.llmWireDebugGuide{padding:10px 12px}.llmWireDebugGuideSteps{gap:4px}.llmWireDebugTraceHeader time{margin-left:0}.llmWireDebugHelp dl>div{grid-template-columns:1fr;gap:1px}.llmWireDebugArtifactBar{flex-wrap:wrap;padding-top:6px;padding-bottom:6px}.llmWireDebugArtifactTabs{flex-basis:100%}}
`
