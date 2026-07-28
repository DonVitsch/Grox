import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Session, SessionBlock, WorkflowRun } from "../../bridge/types";
import { useI18n } from "../../lib/i18n";
import { useDesktop } from "../../state/store";
import { Icon } from "../fx/Icon";
import { BlackHole } from "../fx/BlackHole";
import { AssistantMsg, SystemEvent, UserMsg } from "./blocks";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallCard } from "./ToolCallCard";
import { PlanCard } from "./PlanCard";
import { PermissionCard } from "./PermissionCard";
import { QuestionCard } from "./QuestionCard";
import { TurnChangeCard } from "./TurnChangeCard";

interface Turn {
  id: string;
  blocks: SessionBlock[];
  promptIndex: number;
}

// Keep Zustand's selector snapshot referentially stable when this session has
// never launched a workflow. Creating `[]` in the selector causes React to
// observe a fresh store snapshot on every render and recurse indefinitely.
const EMPTY_WORKFLOWS: WorkflowRun[] = [];

// Deep Research has a separate, durable task timeline. Its launch and
// completion are host-side workflow events, not a normal model turn, so a
// generic "provider did not expose" process panel would be misleading.
function isDeepResearchRequest(block: Extract<SessionBlock, { type: "user" }> | undefined): boolean {
  return Boolean(block && /^\/(?:deep-research|workflow\s+grox-deep-research)\b/i.test(block.text.trim()));
}

function deepResearchQuery(text: string): string | undefined {
  const visible = text.trim().match(/^\/deep-research\s+(.+)$/i);
  if (visible?.[1]) return visible[1].trim();
  const internal = text.trim().match(/^\/workflow\s+grox-deep-research\s+(.+)$/i);
  if (!internal?.[1]) return undefined;
  try {
    const args = JSON.parse(internal[1]) as { query?: unknown };
    return typeof args.query === "string" ? args.query.trim() : undefined;
  } catch {
    return undefined;
  }
}

function matchingResearchRun(
  runs: WorkflowRun[],
  user: Extract<SessionBlock, { type: "user" }> | undefined,
): WorkflowRun | undefined {
  const query = user ? deepResearchQuery(user.text) : undefined;
  const candidates = runs.filter((run) => run.name === "grox-deep-research");
  return candidates.find((run) => query && run.objective.trim() === query)
    ?? candidates.find((run) => !["complete", "failed", "cancelled", "interrupted"].includes(run.status))
    ?? candidates.at(0);
}

function DeepResearchToolCard({ run, query }: { run?: WorkflowRun; query?: string }) {
  const { language } = useI18n();
  const openTasks = useDesktop((state) => state.setInspectorTab);
  const state = run?.status ?? "active";
  const active = !["complete", "failed", "cancelled", "interrupted"].includes(state);
  const failed = state === "failed";
  const tone = failed ? "text-red" : active ? "text-acc" : "text-green";
  const status = failed
    ? (language === "zh-CN" ? "失败" : "FAILED")
    : active
      ? (language === "zh-CN" ? "执行中" : "RUNNING")
      : state === "cancelled" || state === "interrupted"
        ? (language === "zh-CN" ? "已停止" : "STOPPED")
        : (language === "zh-CN" ? "已完成" : "COMPLETE");
  const phase = run?.currentPhase ?? (language === "zh-CN" ? "等待任务状态" : "WAITING FOR TASK STATUS");

  return (
    <button
      type="button"
      onClick={() => openTasks("tasks")}
      className="mb-5 flex w-full items-center gap-3 rounded-[5px] border border-line2 bg-raise/35 px-3 py-2.5 text-left transition-colors hover:border-acc/50 hover:bg-acc/5"
    >
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-line2 bg-void ${tone}`}>
        <Icon name="search" size={13} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10.5px] text-fg2">{language === "zh-CN" ? "深度研究" : "DEEP RESEARCH"}</span>
          <span className={`font-mono text-[8.5px] tracking-[0.08em] ${tone}`}>{status}</span>
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-dim">{query || run?.objective || phase}</span>
      </span>
      <span className="hidden shrink-0 text-right font-mono text-[8.5px] text-faint sm:block">
        {phase}<br />{language === "zh-CN" ? "查看任务详情" : "OPEN TASK DETAILS"}
      </span>
      <Icon name="chevronRight" size={10} className="shrink-0 text-faint" />
    </button>
  );
}

function groupTurns(blocks: SessionBlock[]): Turn[] {
  const turns: Turn[] = [];
  let promptIndex = -1;
  for (const block of blocks) {
    if (block.type === "user") {
      promptIndex += 1;
      turns.push({ id: block.id, blocks: [block], promptIndex });
    } else if (turns.length === 0) turns.push({ id: block.id, blocks: [block], promptIndex: -1 });
    else turns[turns.length - 1].blocks.push(block);
  }
  return turns;
}

function renderBlock(block: SessionBlock, sessionId: string, processing = false) {
  switch (block.type) {
    case "user": return <UserMsg key={block.id} block={block} />;
    case "assistant": return <AssistantMsg key={block.id} block={block} process={processing} />;
    case "thinking": return <ThinkingBlock key={block.id} block={block} processing={processing} />;
    case "tool": return <ToolCallCard key={block.id} block={block} />;
    case "plan": return <PlanCard key={block.id} block={block} />;
    case "permission": return block.req.purpose === "plan" ? null : <PermissionCard key={block.id} block={block} sessionId={sessionId} />;
    case "question": return <QuestionCard key={block.id} block={block} />;
    case "system": return <SystemEvent key={block.id} block={block} />;
  }
}

function ToolBatch({ blocks }: { blocks: Extract<SessionBlock, { type: "tool" }>[] }) {
  const { language } = useI18n();
  const [open, setOpen] = useState(false);
  const commands = blocks.filter((block) => block.call.kind === "execute" || block.call.kind === "terminal").length;
  const edits = blocks.filter((block) => ["edit", "write", "delete", "move"].includes(block.call.kind)).length;
  const busy = blocks.some((block) => ["pending", "running", "awaiting_permission"].includes(block.call.status));
  const summary = language === "zh-CN"
    ? edits && commands ? `编辑了文件并运行了 ${commands} 个命令` : commands ? `运行了 ${commands} 个命令` : edits ? `编辑了 ${edits} 个文件` : `调用了 ${blocks.length} 个工具`
    : edits && commands ? `Edited files and ran ${commands} commands` : commands ? `Ran ${commands} commands` : edits ? `Edited ${edits} files` : `Used ${blocks.length} tools`;

  return (
    <div className="process-tool-batch mb-2 overflow-hidden">
      <button onClick={() => setOpen((value) => !value)} className="process-tool-toggle">
        <span className={`process-node ${busy ? "is-live" : "is-done"}`} aria-hidden="true" />
        <Icon name={commands ? "terminal" : edits ? "edit" : "bolt"} size={11} className="shrink-0 text-dim" />
        <span className="min-w-0 flex-1 truncate text-[10.5px] text-fg2" title={summary}>{summary}</span>
        {busy && <span className="lbl lbl-acc shrink-0 !text-[9px]">{language === "zh-CN" ? "执行中" : "RUNNING"}</span>}
        <Icon name="chevronRight" size={9} className={`shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="ml-[6px] max-h-56 overflow-y-auto border-l border-line2 pb-1 pl-4 pt-1">{blocks.map((block) => <ToolCallCard key={block.id} block={block} />)}</div>}
    </div>
  );
}

function RenderSequence({ blocks, sessionId, processing }: { blocks: SessionBlock[]; sessionId: string; processing: boolean }) {
  const output: React.ReactNode[] = [];
  for (let index = 0; index < blocks.length;) {
    if (blocks[index].type !== "tool") {
      output.push(renderBlock(blocks[index], sessionId, processing));
      index += 1;
      continue;
    }
    const tools: Extract<SessionBlock, { type: "tool" }>[] = [];
    while (index < blocks.length && blocks[index].type === "tool") {
      tools.push(blocks[index] as Extract<SessionBlock, { type: "tool" }>);
      index += 1;
    }
    output.push(<ToolBatch key={`tools-${tools[0].id}`} blocks={tools} />);
  }
  return <>{output}</>;
}

interface TurnGroupProps {
  turn: Turn;
  sessionId: string;
  status: Session["status"];
  active: boolean;
  workflow?: WorkflowRun;
}

function TurnGroup({ turn, sessionId, status, active, workflow }: TurnGroupProps) {
  const { language } = useI18n();
  const complete = !active || status === "idle";
  const [processOpen, setProcessOpen] = useState(!complete);
  const user = turn.blocks.find((block): block is Extract<SessionBlock, { type: "user" }> => block.type === "user");
  const deepResearch = isDeepResearchRequest(user);
  const query = user ? deepResearchQuery(user.text) : undefined;

  useEffect(() => {
    if (complete) setProcessOpen(false);
  }, [complete]);

  if (!complete) {
    const liveBlocks = turn.blocks.filter((block) => block !== user);
    const lastLiveBlock = liveBlocks.at(-1);
    const streamingAnswer = lastLiveBlock?.type === "assistant" ? lastLiveBlock : undefined;
    const processBlocks = streamingAnswer ? liveBlocks.slice(0, -1) : liveBlocks;
    return (
      <section className="timeline-turn mb-8">
        {user && <UserMsg block={user} />}
        {deepResearch && <DeepResearchToolCard run={workflow} query={query} />}
        {!deepResearch && <div className="process-live mb-5">
          <div className="mb-3 flex min-h-8 items-center gap-2">
            <BlackHole size={15} spin />
            <span className="text-[10.5px] font-medium text-fg2">{status === "awaiting_permission" ? (language === "zh-CN" ? "等待批准" : "Awaiting approval") : status === "awaiting_input" ? (language === "zh-CN" ? "等待你的回答" : "Awaiting input") : (language === "zh-CN" ? "Grok 正在处理" : "Grok is working")}</span>
            <span className="h-1 w-1 animate-pulse-dot rounded-full bg-acc" />
            <span className="font-mono text-[9px] tracking-[0.08em] text-faint">{language === "zh-CN" ? `${liveBlocks.length} 条事件` : `${liveBlocks.length} events`}</span>
          </div>
          {processBlocks.length > 0 ? <div className="process-sequence process-rail ml-[7px] pl-5">
            <RenderSequence blocks={processBlocks} sessionId={sessionId} processing />
          </div> : !streamingAnswer ? (
            <div className="process-sequence process-rail ml-[7px] pl-5">
              <div className="mb-3 flex items-center gap-2 text-[10.5px] text-dim">
                <span className="h-1 w-1 animate-pulse-dot rounded-full bg-acc-dim" />
                {language === "zh-CN" ? "等待模型返回第一个事件…" : "Waiting for the first model event…"}
              </div>
            </div>
          ) : null}
        </div>}
        {streamingAnswer && <AssistantMsg block={streamingAnswer} />}
      </section>
    );
  }

  const unresolved = turn.blocks.filter((block) => (block.type === "permission" && !block.resolved) || (block.type === "question" && !block.response));
  const assistants = turn.blocks.filter((block): block is Extract<SessionBlock, { type: "assistant" }> => block.type === "assistant");
  const finalAssistant = assistants.at(-1);
  const process = turn.blocks.filter((block) => block !== user && block !== finalAssistant && !unresolved.includes(block));
  const toolCount = process.filter((block) => block.type === "tool").length;
  const thoughts = process.filter((block): block is Extract<SessionBlock, { type: "thinking" }> => block.type === "thinking");
  const thoughtCount = thoughts.length;
  const elapsed = thoughts.reduce((sum, block) => sum + (block.elapsedMs ?? 0), 0);
  const intermediateTextCount = process.filter((block) => block.type === "assistant").length;
  const otherEventCount = process.length - toolCount - thoughtCount - intermediateTextCount;
  const summaryParts = language === "zh-CN"
    ? [
        thoughtCount ? `${thoughtCount} 段思考` : "",
        intermediateTextCount ? `${intermediateTextCount} 段文字` : "",
        toolCount ? `${toolCount} 个工具` : "",
        otherEventCount ? `${otherEventCount} 条运行事件` : "",
      ].filter(Boolean)
    : [
        thoughtCount ? `${thoughtCount} thoughts` : "",
        intermediateTextCount ? `${intermediateTextCount} text segments` : "",
        toolCount ? `${toolCount} tools` : "",
        otherEventCount ? `${otherEventCount} runtime events` : "",
      ].filter(Boolean);
  const processSummary = summaryParts.length > 0
    ? summaryParts.join(" · ")
    : language === "zh-CN" ? "服务商未公开思考或工具过程" : "Provider did not expose reasoning or tool activity";

  const finishedAt = Math.max(user?.ts ?? 0, ...turn.blocks.map((block) => block.type === "tool" ? block.call.endedAt ?? block.ts : block.ts));
  const turnElapsed = user && finishedAt > user.ts ? finishedAt - user.ts : 0;

  return (
    <section className="timeline-turn mb-8">
      {user && <UserMsg block={user} rewindPromptIndex={turn.promptIndex >= 0 ? turn.promptIndex : undefined} />}
      {deepResearch && <DeepResearchToolCard run={workflow} query={query} />}
      {!deepResearch && <div className="process-complete mb-5">
        <button className="process-summary" onClick={() => setProcessOpen((open) => !open)}>
          <Icon name={processOpen ? "chevronDown" : "chevronRight"} size={9} className="shrink-0 text-dim" />
          <span className="shrink-0 text-[10.5px] font-medium text-fg2">{language === "zh-CN" ? "已处理" : "Processed"}</span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-dim" title={processSummary}>{processSummary}{elapsed ? ` · ${(elapsed / 1000).toFixed(1)}s` : ""}</span>
          <Icon name="check" size={9} className="text-green" />
        </button>
        {processOpen && (
          <div className="process-sequence process-rail ml-[7px] mt-2 border-l border-line2 pb-1 pl-5 pt-2">
            {process.length > 0 ? (
              <RenderSequence blocks={process} sessionId={sessionId} processing />
            ) : (
              <p className="mb-3 text-[10.5px] leading-relaxed text-dim">{language === "zh-CN" ? "本轮 API 只返回了最终答复；无法据此判断服务商内部是否调用了工具。" : "The API returned only a final answer; provider-internal tool usage cannot be determined from this response."}</p>
            )}
          </div>
        )}
        {turnElapsed > 0 && <div className="turn-elapsed"><span>{language === "zh-CN" ? `已处理 ${turnElapsed < 1000 ? `${turnElapsed}ms` : `${(turnElapsed / 1000).toFixed(turnElapsed < 10_000 ? 1 : 0)}s`}` : `Processed in ${(turnElapsed / 1000).toFixed(1)}s`}</span><i /></div>}
      </div>}
      {unresolved.map((block) => renderBlock(block, sessionId))}
      {finalAssistant && <AssistantMsg block={finalAssistant} />}
      <TurnChangeCard blocks={turn.blocks} promptIndex={turn.promptIndex} />
    </section>
  );
}

const MemoTurnGroup = memo(TurnGroup, (previous, next) => {
  if (previous.active !== next.active || previous.sessionId !== next.sessionId || previous.workflow !== next.workflow) return false;
  if (next.active && previous.status !== next.status) return false;
  if (previous.turn.blocks.length !== next.turn.blocks.length) return false;
  if (previous.turn.promptIndex !== next.turn.promptIndex) return false;
  return previous.turn.blocks.every((block, index) => block === next.turn.blocks[index]);
});

export function Timeline({ session }: { session: Session }) {
  const { language } = useI18n();
  const workflows = useDesktop((state) => state.workflows[session.id] ?? EMPTY_WORKFLOWS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  const turns = useMemo(() => groupTurns(session.blocks), [session.blocks]);
  const lastBlock = session.blocks.at(-1);
  const signature = `${session.blocks.length}:${lastBlock?.type === "assistant" || lastBlock?.type === "thinking" ? lastBlock.text.length : lastBlock?.id ?? ""}:${session.status}`;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (element && followRef.current) element.scrollTop = element.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [signature]);

  if (session.blocks.length === 0) return <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-24"><BlackHole size={44} spin="slow" /><div className="text-center"><p className="text-[14px] text-mute">{language === "zh-CN" ? "任务通道已打开。" : "Mission channel open."}</p><p className="lbl mt-1.5 !text-[10px]">{language === "zh-CN" ? "输入你的第一个请求" : "TRANSMIT YOUR FIRST DIRECTIVE"}</p></div></div>;

  return <div ref={scrollRef} onScroll={() => { const element = scrollRef.current; if (element) followRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} className="flex-1 overflow-y-auto"><div className="mx-auto max-w-[860px] px-8 py-8">{turns.map((turn, index) => {
    const user = turn.blocks.find((block): block is Extract<SessionBlock, { type: "user" }> => block.type === "user");
    return <MemoTurnGroup key={turn.id} turn={turn} sessionId={session.id} status={session.status} active={index === turns.length - 1} workflow={matchingResearchRun(workflows, user)} />;
  })}<div className="h-2" /></div></div>;
}
