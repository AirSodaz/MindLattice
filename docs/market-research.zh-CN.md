# MindLattice Market Research and Product Direction

| Field | Value |
| --- | --- |
| Status | Draft |
| Owner | Product and engineering |
| Last updated | 2026-05-17 |
| Scope | 市场判断、竞品分层、开发方向、功能设计与用户交互设计建议 |

## Purpose

本文用于回答 MindLattice 这类软件是否有清晰市场空间，以及第一阶段应该如何定位、开发和设计交互。结论服务于 `docs/product.md`、`docs/architecture.md`、`docs/ui-style.md` 和 `docs/development-plan.md` 的后续修订，但本文本身不直接改变 MVP 范围。

MindLattice 当前最有价值的定位不是普通待办、心理健康 App、知识管理工具或 AI 聊天产品，而是一个本地优先的 conversational execution workbench：用对话把混乱工作记忆转换成可见的 star-map canvas，再通过 confirm-before-write 让用户确认持久化内容，最后收束到一个 Start Mode 下一步行动。

## Executive Summary

市场方向是成立的，但不能用单一品类理解。MindLattice 位于四个增长中的需求交叉处：成人 ADHD traits 与执行功能支持、个人知识管理、本地优先隐私工具、AI 辅助任务拆解与计划执行。

外部数据支持“需求存在”，但不支持夸大为医疗市场：

- CDC 2024 年 MMWR 基于 2023 年调查估计，美国约 1,550 万成年人有当前 ADHD 诊断，占成年人 6.0%，其中约一半在成年后获得诊断。这说明成年人执行功能支持有现实人群基础，但产品文案不能把诊断人群等同为可直接转化用户。
- Grand View Research 估计 2024 年全球 mental health apps 市场为 74.8 亿美元，2025-2030 年 CAGR 为 14.6%；productivity management software 2023 年为 598.8 亿美元，2024-2030 年 CAGR 为 14.1%；knowledge management software 2024 年为 201.5 亿美元，2025-2033 年 CAGR 为 13.6%。这些数字只能作为方向性信号，不能相加成 MindLattice 的 TAM。
- FDA general wellness guidance 和 JAN ADHD accommodation 资料共同提示：低风险 wellness、环境调整、checklist、reminder、written instructions、task separation、uninterrupted work time 等是合适的产品设计素材；诊断、治疗、症状评分、用药建议和临床结论必须继续排除。

产品机会不是“再做一个 ADHD App”，而是补足现有工具之间的断层：

- PKM 工具善于存储和连接信息，但弱于把模糊责任收束到可启动行动。
- 任务和日历工具善于管理已知任务，但弱于处理“不知道怎么开始”的前置认知负担。
- ADHD / neurodivergent 工具善于提供支持策略、视觉计划和 coaching，但常见形态是移动端、内容课程、习惯/日程工具或云端服务。
- AI workspace 工具善于生成和整理内容，但通常不是本地优先，也缺少面向低刺激执行流的 preview confirmation boundary。

MindLattice 的差异化核心应该保持为：conversation-first、visible preview、local source of truth、one-action Start Mode、support experiments、confirmed memory。

## Market Segments

### Adult Execution Support

目标用户不是“所有 ADHD 患者”，而是成年人中经常遇到 task paralysis、context loss、overwhelm、switching cost、return-after-interruption 难题的人。这个用户群可能有正式诊断，也可能只是 self-identified ADHD traits 或 executive function difficulty。

这一市场的关键不是医疗结论，而是日常场景：

- 工作任务太大，无法找到第一步。
- 已经有 Todoist、Notion、Obsidian 或纸质笔记，但任务仍然无法启动。
- 临时打断后无法恢复上下文。
- 任务需要材料、文件、沟通和环境准备，但这些内容散在多个地方。
- 用户需要低羞耻、低刺激的开始方式，而不是评分、连击或激励语。

MindLattice 应把这些需求描述为 execution support、external memory、startable action、return cue 和 low-risk support，不应描述为 symptom reduction 或 ADHD treatment。

### Personal Knowledge Management and Local-First Users

Obsidian、Logseq、Anytype、Capacities、Heptabase 和 Tana 证明了用户愿意为个人知识图谱、结构化笔记和本地/隐私叙事付费或投入学习成本。Obsidian 官方文档强调 notes are stored as plain text files，并提供 graph view；Anytype 官方文档强调 offline first 和 local-first storage；Heptabase 把 cards、whiteboards、mindmaps 和 AI chat 结合起来。

这类用户有 MindLattice 的早期采用者特征：

- 愿意使用桌面工具。
- 关心数据可迁移、Markdown、导入导出和长久保存。
- 能接受一定配置成本，例如 LLM provider setup 或 BYOK。
- 已经理解 graph、backlink、whiteboard 或 card 的价值。

但 PKM 用户的痛点也很清楚：图谱容易变成“可视化收藏”，没有把信息推到行动；白板越大越难维护；AI chat 往往是知识问答，而不是对当前执行障碍做确认前写入的结构化提案。

### Task, Calendar, and AI Planning Users

Motion、Reclaim、Sunsama、Todoist、Microsoft Planner 和 Notion AI 代表了另一个方向：把任务、日历、项目和 AI 集成到工作流里。Sunsama 的 guided daily planning 强调 calm、focused、achievable plan；Reclaim 用 AI 防守 focus time、tasks、habits 和 breaks；Microsoft Planner Agent 在 Copilot 中以 interactive task cards 让用户查看和更新任务；Todoist AI Assistant 可以生成任务建议或拆解。

这类产品的强项是调度、集成和团队协作。MindLattice 不应该正面竞争“最强日历调度”或“最强项目管理”。可切入的空白是：当任务还不是清晰任务、用户还不知道 first action、阻碍还没被命名、支持策略还没试过时，传统任务/日历工具通常开始得太晚。

### Neurodivergent and ADHD-Focused Tools

Tiimo、Inflow、Shimmer、Amazing Marvin 和 Magic ToDo 展示了 neurodivergent / ADHD 友好工具的常见产品形态：

- Tiimo 强调 visual timeline、AI task breakdown、flexible scheduling 和 widgets。
- Inflow 强调 CBT principles、课程、community、AI companion、task breakdown 和 body doubling。
- Shimmer 强调 human-centered ADHD coaching 和 productivity tools。
- Amazing Marvin 提供大量 ADHD 相关 task management strategy。
- Magic ToDo 提供极简 AI task breakdown，并允许用主观难度控制拆解粒度。

MindLattice 应学习这些产品的“低门槛、少羞耻、可视化、拆小”的优点，但避免跟随它们进入 clinical claim、content course、coaching marketplace、habit streak 或移动端日程助手路线。MindLattice 的独特机会是：把支持策略、任务拆解、上下文图谱、偏好记忆和 Start Mode 统一到一个本地数据模型中，而不是散落在课程、待办和聊天回答里。

## Competitive Landscape

| Layer | Representative products | Strengths | Gap MindLattice can target |
| --- | --- | --- | --- |
| Local-first PKM | Obsidian, Logseq, Anytype | 本地/隐私、Markdown、链接、图谱、插件生态 | 需要用户自己维护结构，弱于从 messy task 到 startable action |
| Visual knowledge work | Heptabase, Capacities, Tana | cards、whiteboards、object types、AI search/chat | 偏知识组织和资料理解，不以 execution support 为核心 |
| Task and calendar planning | Sunsama, Motion, Reclaim, Todoist | 日计划、时间块、调度、提醒、任务集成 | 假设任务已经清晰，弱于 blocker、context、return cue |
| AI workspace | Notion AI, Microsoft Planner Agent, Tana AI | AI 嵌入已有 workspace，能生成、搜索、更新任务 | 多为云端和团队场景，write boundary 与本地隐私不突出 |
| ADHD / neurodivergent apps | Tiimo, Inflow, Shimmer, Amazing Marvin, Magic ToDo | 视觉计划、任务拆解、coaching、community、strategy | 常偏移动端、课程、习惯、调度或单点工具；长期上下文图谱较弱 |

### Strategic Position

MindLattice 应避免三个拥挤赛道：

- 不做“更复杂的 Todoist”。
- 不做“更医疗的 Inflow”。
- 不做“更漂亮的 Obsidian 图谱”。

推荐定位：

> A local-first execution workbench that turns messy working memory into a visible, reviewable map and one calm next action.

中文内部表述：

> 一个本地优先的执行支持工作台，把混乱工作记忆变成可确认的可视化任务图谱，再收束到一个能开始的下一步。

这个定位与当前 PRD 的 agent-first loop、star-map canvas、Start Mode、support template、strategy experiment、confirmed memory 和 non-medical boundary 一致。

## Product Direction

### Development Thesis

MindLattice 的开发方向应该先证明一个重复发生的成功循环，而不是堆功能：

1. 用户用自然语言倾倒混乱任务。
2. Agent 生成低刺激回应和结构化 agent preview。
3. Canvas 让任务、blocker、resource、support、next action 同时可见。
4. 用户用自然语言修改 preview。
5. 用户显式接受后才写入本地 SQLite。
6. Start Mode 隐藏图谱复杂度，只保留一个行动和少量上下文。
7. Follow-up 记录是否开始、卡在哪里、支持是否有帮助。
8. Confirmed memory 只保存用户可见且可编辑的执行偏好。

第一阶段成败不取决于节点类型数量，而取决于用户是否能在 2-3 分钟内从“脑子一团乱”走到“我知道现在先做哪一步”。

### Primary Wedge

建议早期 wedge 是：

- 桌面端知识工作者、研究生、自由职业者、独立开发者、项目/文档工作者。
- 已经使用 Obsidian/Notion/Todoist/日历，但仍被任务启动和上下文恢复困住的人。
- 愿意 BYOK 或配置 OpenAI-compatible provider，以换取本地数据源和透明写入边界的人。

暂不建议第一阶段追逐：

- 企业团队协作。
- 临床 ADHD 管理。
- 学校/家长/儿童市场。
- 移动端全天候提醒。
- 自动日历调度。

### Release Strategy

First release 应以 private beta 或 small paid beta 验证：

- 用户是否理解 local-first + cloud LLM provider 的组合。
- 用户是否愿意把 messy task 交给 agent 生成 preview。
- 用户是否能接受 confirm-before-write 的额外一步。
- Start Mode 是否真的降低噪声，而不是成为另一个页面。
- 支持策略和 strategy experiment 是否被当成有用记录，而不是心理健康打卡。

可观察指标应避开医疗和 productivity score：

- 从首次输入到首次 accepted preview 的完成率。
- Accepted preview 后进入 Start Mode 的比例。
- 一周内创建的 start plans 数量。
- 用户返回中断任务时能否打开原上下文。
- Support experiment 的 keep/revise/pause/remove 记录率。
- 被用户编辑或删除的 preference memory 数量，用来衡量 trust boundary 是否透明。

## Functional Design Recommendations

### P0: Keep the Current MVP Spine

P0 功能应紧贴现有 Phase 1-7 scaffold：

- LLM provider setup：明确 base URL、API key、model、timeout，并在 setup 前禁用 agent composer。
- Agent thread：作为 quick capture 和 preview revision 的主入口。
- Agent preview：所有 graph、support、check-in、strategy experiment、preference memory 写入前都可查看、修改、拒绝。
- Star-map canvas：只服务当前执行上下文，不做全局知识宇宙。
- Start Mode：一个 next action、minimum done、current blocker、up to three support/context items、return cue。
- Support templates：围绕环境、任务结构、外部记忆、书面沟通、休息/切换、工作/学习调整。
- Strategy experiment：只记录对 start、continue、return、clarify next action 是否有帮助。
- Confirmed memory：用户可见、可编辑、可禁用、可删除。
- Manual Markdown import/export：服务 Obsidian-compatible 用户，但 SQLite 仍是 authoritative source。

### P1: Improve Differentiation After MVP

P1 可以围绕“执行闭环”增强，而不是扩大品类：

- Preview diff：接受前清楚显示新增、修改、删除、支持采纳和 memory proposal。
- Return context：中断后打开任务时，优先显示 last next action、last blocker、last return cue、last support result。
- Support matching quality：让 agent 解释为什么推荐某个 support template，但保持一句话，不做长篇教学。
- Start Mode revision：用户说“还是太大”，直接生成更小 action 的 preview。
- Preference memory review inbox：集中显示 agent 提议的记忆，允许批量 reject 或 edit。
- Vault export profile：提供 Obsidian-readable 和 plain Markdown 两种导出风格。

### P2: Defer Deliberately

以下功能有吸引力，但第一阶段会稀释定位：

- 移动端和全天候通知。
- 云同步、账号和团队协作。
- Calendar auto-scheduling。
- 完整项目管理套件。
- 习惯 streak、积分、成就或 productivity score。
- 症状量表、诊断问卷、治疗建议、用药记录。
- 无确认的 autonomous write。
- 插件市场和复杂模板生态。

## User Interaction Design

### Workbench Layout

当前 `Quiet Workshop` 两栏方向是正确的：

- 左侧是 agent thread：输入、短回应、运行状态、停止按钮、当前 preview 关系。
- 右侧是 turn context pane：provider setup、preview review、star-map canvas、Start Mode、settings 或 secondary task panel。
- Canvas 不应常驻为唯一中心，也不应退化成聊天附件。对话负责意图，canvas 负责外部工作记忆。

### Core Interaction Flow

建议把首屏体验设计成一个明确状态机：

1. No provider：显示 provider setup required，composer disabled。
2. Ready：composer 提示用户倾倒一个任务、阻碍或状态。
3. Drafting：agent 以 subdued tool-status 显示正在拆解、检查 safety、生成 preview。
4. Preview：右侧显示 preview review，canvas 中 draft nodes/edges 与 persisted content 有明确差异。
5. Revise：用户在左侧自然语言修改，右侧仍保留同一 preview 的连续性。
6. Accept：写入本地 source of truth，draft styling 转成 persisted styling。
7. Start：右侧进入 Start Mode，只显示一个行动。
8. Follow-up：用户记录是否开始、卡在哪里、support 是否帮助，并可选择是否保存 preference memory。

### Low-Stimulus Design Rules

界面应继续避免：

- dashboard 式指标堆叠。
- 彩色能量条和过度图标化。
- streak、score、rank、productivity percentage。
- “你做得真棒”这类可能显得幼稚或施压的激励语。
- therapy-session framing 或 anthropomorphic intimacy。

应强化：

- 稳定布局。
- 短句。
- 清楚按钮：Accept preview、Reject、Revise。
- 一次只显示一个主要任务面板。
- 键盘优先：capture、save selected node、enter Start Mode、stop agent turn。
- 色彩不能作为唯一状态来源；preview 应有 label、outline、badge 或 diff text。

### Copy and Tone

推荐文案风格：

- “先找一个能开始的动作。”
- “这些是待确认的改动。”
- “接受后会保存到本地。”
- “这个支持只作为一次实验，之后可以保留、调整、暂停或移除。”
- “如果现在太大，可以再拆小。”

避免文案：

- “治疗 ADHD。”
- “改善症状。”
- “临床建议。”
- “最适合你的 ADHD 策略。”
- “你今天效率提升了 X%。”
- “连续完成 N 天。”

## Business and Positioning Notes

### Packaging

早期更适合 desktop-first paid beta 或 free preview + paid license，而不是广告、内容订阅或 coaching marketplace。原因：

- local-first 用户更容易接受一次性或年度桌面工具付费。
- BYOK LLM 降低模型成本和隐私争议，但需要更好的 setup UX。
- 如果走订阅，价值应来自持续产品能力，而不是医疗内容。

### Trust Story

MindLattice 的 trust story 应明确：

- 本地 SQLite 是 accepted data 的 source of truth。
- AI 只能生成 preview，不能静默写入。
- Provider setup 由用户配置。
- Preference memory 可见、可编辑、可删除。
- Markdown import/export 保障迁移路径。
- 产品不做诊断、治疗、用药或症状评分。

这比“AI 更懂你”更适合该产品。早期用户需要的不是人格化陪伴，而是可靠边界。

### Go-To-Market

推荐先做窄渠道验证：

- Obsidian / PKM 用户：强调 local data、Markdown export、graph-to-action。
- ADHD traits / executive function 社群：强调 task start、return cue、低羞耻支持，不做治疗承诺。
- 独立开发者和研究生：强调复杂任务拆解、项目材料上下文、Start Mode。
- Windows desktop early adopters：强调可本地安装、BYOK、可审查写入。

Demo 应展示一个完整闭环，而不是功能列表：

1. 输入一段混乱任务。
2. 生成可视化 preview。
3. 自然语言改成更小。
4. 接受写入。
5. 进入 Start Mode。
6. 记录一次 support experiment。

## Risks and Mitigations

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Medical boundary drift | ADHD 相关产品容易滑向诊断、治疗、症状承诺 | 保持 low-risk wellness 语言；core safety validation 阻断 medical、diagnostic、medication 和 symptom-score 内容 |
| AI overtrust | 用户可能误以为 agent 写入的是事实或建议 | 所有写入走 preview；显示 source/context；偏好记忆必须可见确认 |
| Setup friction | BYOK 和 provider setup 会劝退非技术用户 | 首次启动只问必要字段；测试连接；给出短错误；不要提供假的 local fallback |
| Canvas overload | 图谱容易变复杂，增加认知负担 | 默认限制 preview 节点数量；Start Mode 隐藏复杂度；只显示当前 turn context |
| Local-only data loss | 本地优先需要用户理解备份责任 | 提供清晰 export、backup 提醒和 app-data 位置说明 |
| Commodity AI task breakdown | 单纯 task breakdown 容易被 Todoist、Notion、Magic ToDo 替代 | 差异化放在 visible graph、confirmed memory、support experiments、return context |
| Feature creep | 日历、移动端、同步、社区和课程都很诱人 | First release 只证明 execution loop；P2 功能必须通过用户证据再进入 |

## Recommended Next Decisions

1. 把对外定位固定为 execution support / external working memory / low-risk wellness，避免 mental health app 或 therapy app 叙事。
2. 在 README 或未来 landing copy 中用一句话说明：conversation turns messy tasks into a reviewable map and one next action。
3. 优先打磨 provider setup、preview review、Start Mode、follow-up 这四个体验，而不是增加新节点类型。
4. 把 support template 内容治理作为产品资产维护：每张 card 必须有 source note 和 safety note。
5. 为 private beta 设计 5 个真实任务脚本：写论文、修 bug、整理报税材料、准备会议、清理长期拖延的个人项目。
6. 把成功指标写成行为指标，不写症状、疗效或效率分。

## References

- [CDC MMWR: ADHD Diagnosis, Treatment, and Telehealth Use in Adults, United States, October-November 2023](https://www.cdc.gov/mmwr/volumes/73/wr/mm7340a1.htm)
- [Grand View Research: Mental Health Apps Market](https://www.grandviewresearch.com/industry-analysis/mental-health-apps-market-report)
- [Grand View Research: Productivity Management Software Market](https://www.grandviewresearch.com/industry-analysis/productivity-management-software-market)
- [Grand View Research: Knowledge Management Software Market](https://www.grandviewresearch.com/industry-analysis/knowledge-management-software-market-report)
- [FDA: General Wellness Policy for Low Risk Devices](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices)
- [Job Accommodation Network: Attention Deficit/Hyperactivity Disorder](https://askjan.org/disabilities/Attention-Deficit-Hyperactivity-Disorder-AD-HD.cfm)
- [NICE NG87: ADHD Diagnosis and Management Recommendations](https://www.nice.org.uk/guidance/ng87/chapter/recommendations)
- [Obsidian Help: How Obsidian stores data](https://obsidian.md/help/data-storage)
- [Obsidian Help: Graph view](https://obsidian.md/help/plugins/graph)
- [Anytype Docs: Storage and Deletion](https://doc.anytype.io/anytype-docs/advanced/data-and-security/data-storage-and-deletion)
- [Heptabase Help: AI Space Access](https://support.heptabase.com/en/articles/13009956-what-data-can-ai-access-when-i-turn-on-the-space-option-in-the-ai-chat)
- [Heptabase Help: Performance and Lag Issues](https://support.heptabase.com/en/articles/11430704-troubleshooting-performance-and-lag-issues-in-heptabase)
- [Tana Docs: Tana AI](https://tana.inc/docs/tana-ai)
- [Sunsama User Manual: Daily Planning](https://help.sunsama.com/docs/daily-planning)
- [Reclaim Help Center: Features in Reclaim](https://help.reclaim.ai/en/articles/6210740-features-in-reclaim)
- [Microsoft Support: Planner Agent in Copilot](https://support.microsoft.com/en-us/topic/what-can-you-do-with-planner-agent-in-copilot-e3a3689f-27f4-4fa6-b0f4-a9b9dc784d20)
- [Notion Help Center: What is Notion AI?](https://www.notion.com/help/notion-ai-faqs)
- [Todoist Integrations: Task Assist](https://www.todoist.com/integrations/apps/task-assist)
- [Tiimo: Visual Planner for Every Neurotype](https://www.tiimoapp.com/)
- [Inflow: How it Works](https://www.getinflow.io/how-it-works)
- [Shimmer ADHD Coaching](https://www.shimmer.care/)
- [Amazing Marvin: Features for ADHD](https://amazingmarvin.com/for/adhd/)
- [Magic ToDo](https://goblin.tools/todo)
