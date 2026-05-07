import React, { useEffect, useRef, useState } from "react";

function assetUrl(path) {
  if (!path) return "";
  const value = String(path).trim();
  if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
  return value
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^\.\//, "");
}

const CANVAS_PREVIEW = false;
const USE_LOCAL_CACHE = false;
const DEFAULT_AVATAR = assetUrl("works/profile/avatar.png");
const DEFAULT_QR = assetUrl("works/profile/qrcode.png");
const DEFAULT_COMFYUI_COVER = assetUrl("works/comfyui/cover.webp");
const PORTFOLIO_DB_NAME = "design-portfolio-local-v1";
const PORTFOLIO_STORE_NAME = "snapshots";
const PORTFOLIO_SNAPSHOT_ID = "latest";
const INTRO_STORAGE_KEY = "design-portfolio-intro-accepted-v2";
const EDIT_MODE_PASSWORD = "144544779";

function openPortfolioDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this preview environment."));
      return;
    }
    const request = indexedDB.open(PORTFOLIO_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PORTFOLIO_STORE_NAME)) {
        db.createObjectStore(PORTFOLIO_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB."));
  });
}

async function loadPortfolioSnapshot() {
  const db = await openPortfolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTFOLIO_STORE_NAME, "readonly");
    const store = tx.objectStore(PORTFOLIO_STORE_NAME);
    const request = store.get(PORTFOLIO_SNAPSHOT_ID);
    request.onsuccess = () => resolve(request.result?.snapshot || null);
    request.onerror = () => reject(request.error || new Error("Failed to load portfolio snapshot."));
    tx.oncomplete = () => db.close();
  });
}

async function savePortfolioSnapshot(snapshot) {
  const db = await openPortfolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTFOLIO_STORE_NAME, "readwrite");
    const store = tx.objectStore(PORTFOLIO_STORE_NAME);
    const request = store.put({ id: PORTFOLIO_SNAPSHOT_ID, snapshot, updatedAt: Date.now() });
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("Failed to save portfolio snapshot."));
    tx.oncomplete = () => db.close();
  });
}

async function deletePortfolioSnapshot() {
  const db = await openPortfolioDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTFOLIO_STORE_NAME, "readwrite");
    const store = tx.objectStore(PORTFOLIO_STORE_NAME);
    const request = store.delete(PORTFOLIO_SNAPSHOT_ID);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error || new Error("Failed to delete portfolio snapshot."));
    tx.oncomplete = () => db.close();
  });
}

function readFileAsDataUrl(file, callback) {
  const reader = new FileReader();
  reader.onload = () => callback(String(reader.result || ""));
  reader.onerror = () => callback("");
  reader.readAsDataURL(file);
}

function Icon({ name, className = "h-5 w-5" }) {
  const paths = {
    arrow: ["M5 12h14", "m13 5 7 7-7 7"],
    gallery: ["M4 5h16v14H4z", "M8 11l3 3 2-2 3 4", "M8 9h.01"],
    upload: ["M12 16V4", "m7 11-7-7-7 7", "M5 20h14"],
    file: ["M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z", "M14 3v6h6", "M8 13h8", "M8 17h5"],
    qr: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h2v2h-2z", "M18 14h2v6h-6v-2h4z", "M14 18h2v2h-2z"],
    close: ["M6 6l12 12", "M18 6 6 18"],
    spark: ["M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z", "M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z"],
  };

  const selected = paths[name] || paths.arrow;

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {selected.map((d, index) => <path key={index} d={d} />)}
    </svg>
  );
}

function Pill({ children, tone = "light" }) {
  const styles = tone === "dark"
    ? "border-white/10 bg-white/10 text-white/75"
    : "border-[#1e2a33]/10 bg-white/55 text-[#5b6670]";
  return <span className={`rounded-full border px-3 py-1 text-xs backdrop-blur ${styles}`}>{children}</span>;
}

function SectionTitle({ eyebrow, title, text }) {
  return (
    <div className="mb-9 max-w-3xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.32em] text-[#8c969f]">{eyebrow}</p>
      <h2 className="text-4xl font-semibold tracking-[-0.05em] text-[#1e2a33] md:text-5xl">{title}</h2>
      {text ? <p className="mt-4 text-base leading-8 text-[#66727d]">{text}</p> : null}
    </div>
  );
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function handleImageFallback(event) {
  const image = event.currentTarget;
  const rawSrc = image.getAttribute("src") || "";
  if (!rawSrc || rawSrc.startsWith("data:") || rawSrc.startsWith("blob:")) return false;

  let path = rawSrc;
  try {
    const parsedUrl = new URL(rawSrc, window.location.origin);
    path = parsedUrl.pathname;
  } catch (error) {
    path = rawSrc;
  }

  const cleanPath = path
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^public\/public\//, "")
    .replace(/\.png\.png$/i, ".png");

  const candidates = [];
  const addCandidate = (value) => {
    const normalized = assetUrl(value);
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
  };

  addCandidate(cleanPath);
  if (/\.png$/i.test(cleanPath)) addCandidate(`${cleanPath}.png`);
  if (/\.jpg$/i.test(cleanPath)) addCandidate(cleanPath.replace(/\.jpg$/i, ".png"));
  if (/\.jpeg$/i.test(cleanPath)) addCandidate(cleanPath.replace(/\.jpeg$/i, ".png"));
  if (/\.webp$/i.test(cleanPath)) addCandidate(cleanPath.replace(/\.webp$/i, ".png"));

  const currentIndex = Number(image.dataset.fallbackIndex || "0");
  const nextIndex = currentIndex + 1;
  if (nextIndex < candidates.length) {
    image.dataset.fallbackIndex = String(nextIndex);
    image.src = candidates[nextIndex];
    return true;
  }

  image.style.opacity = "0.28";
  return false;
}

function CoverImage({ src, alt, fit = "cover", crop, className = "", imageClassName = "" }) {
  const safeCrop = crop || { x: 50, y: 50, scale: 1 };
  const isContain = fit === "contain";
  const isCustom = fit === "custom";

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        draggable="false"
        className={`absolute inset-0 h-full w-full select-none transition duration-300 ${isContain ? "object-contain" : "object-cover"} ${imageClassName}`}
        style={isCustom ? {
          objectPosition: `${safeCrop.x}% ${safeCrop.y}%`,
          transform: `scale(${safeCrop.scale})`,
          transformOrigin: `${safeCrop.x}% ${safeCrop.y}%`,
        } : undefined}
        onError={handleImageFallback}
      />
    </div>
  );
}

const heroKeywords = ["工业设计", "AI辅助设计", "LoRA训练", "产品概念表达"];

const personalMeta = [
  "2025届毕业生",
  "产品设计（本科）",
  "华北理工大学",
  "2002-04",
  "共青团员",
  "15303341068",
  "919901815@qq.com",
];

const resumeSections = [
  { title: "教育背景", items: ["2021.09 - 2025.06  华北理工大学（全日制） 产品设计（本科）"] },
  {
    title: "所获奖项",
    items: [
      "东方设计奖国家级二等奖 × 2",
      "大学生文化创意设计奖国家级三等奖",
      "未来设计师省级二等奖",
      "河北省工业设计大赛省级一等奖",
      "新加坡金莎设计奖：银奖",
      "晋江市文创大赛 Top20",
    ],
  },
  {
    title: "实习 / 工作经历",
    groups: [
      {
        period: "2025.07 - 2025.10",
        company: "佛山洛可可",
        role: "AI工业设计师",
        points: [
          "使用AI工具介入产品设计前期方案输出，从调研、概念产出、造型初步建立到多视图深化，探索AI与设计师之间的工作边界。",
          "独立完成多个项目前期立项调研报告与方案输出，并结合甲方要求使用AI高效推进方案。",
          "通过调研报告与网络素材搜集建立数据集，深化LoRA小模型训练并微调大模型，使团队使用生成式AI时更具变化性，更贴合设计概念。",
          "根据甲方反馈及时调整设计方案，优化产品细节与用户体验；通过LoRA训练及AI模型多形态应用，使设计效率提高约40%。",
        ],
      },
      {
        period: "2024.10 - 2025.02",
        company: "北京数美万物",
        role: "AIGC实习生",
        points: [
          "使用Stable Diffusion进行产品设计方案产出，并利用素材训练小型LoRA模型，为项目提供参考图像支持。",
          "协助模型训练师进行设计素材分类底座模型的素材筛选，累计筛选素材量达9万余张。",
          "参与助力车LoRA训练与打标，优化关键词结构并结合手绘辅助，提高LoRA出图稳定性。",
        ],
      },
    ],
  },
  {
    title: "校企合作经历",
    items: [
      "2024.06 - 2024.07  保定长城汽车  交流项目主创",
      "基于多模态大模型能力，从0到1打造未来城市风格汽车造型设计方案。",
      "通过构建Stable Diffusion、风格LoRA及ComfyUI工作流，结合人工评测进行AI多模态可控式设计。",
      "负责产品思路框架、SD工作流搭建、LoRA模型训练，并作为主讲人在保定长城汽车总部汇报。",
    ],
  },
  {
    title: "AI训练 / 产品设计经历",
    items: [
      "2024.03 - 2024.05  城市积木象棋  项目主创：将晋江建筑造型与积木融合，并结合传统象棋玩法增强产品可玩性。",
      "2024.07 - 2024.09  户外露营灯  项目主创：通过模块化设计整合休闲音乐、灯光照明、电子产品充电等功能。",
      "2025.06 - 2025.07  小米投影仪  项目主创：基于麦橘V7模型训练便携投影仪LoRA，使用约40张素材进行180轮训练。",
      "2025.07 - 2025.07  TCL空调  项目主创：基于新世界XL模型训练移动小空调与壁挂式空调素材，约30张素材进行200轮训练，并延伸TCL-LoRA。",
    ],
  },
];

function createStaticImages(folder, count, prefix = "img", ext = "webp") {
  return Array.from({ length: count }, (_, index) => {
    const fileName = `${String(index + 1).padStart(2, "0")}.${ext}`;
    return {
      id: `${prefix}-${index + 1}`,
      name: fileName,
      url: assetUrl(`${folder}/${fileName}`),
    };
  });
}

function createStaticWork({ id, title, tag, folder, count, ext = "webp" }) {
  const images = createStaticImages(folder, count, id, ext);
  return {
    id,
    title,
    desc: `共 ${count} 张作品图片，点击可在大窗口中滑动查看。`,
    tag,
    type: "static",
    coverUrl: images[0]?.url || "",
    coverFit: "cover",
    images,
  };
}

// 上线固定数据：作品集图片使用 webp；头像与二维码仍使用 png。
// 示例：createStaticWork({ id: "industrial-001", title: "作品名称", tag: "落地设计/手绘方案", folder: "works/industrial/work-01", count: 6, ext: "webp" })
const initialIndustrial = [
  createStaticWork({ id: "industrial-001", title: "积木文创产品设计", tag: "落地设计/手绘方案", folder: "works/industrial/work-01", count: 13 }),
  createStaticWork({ id: "industrial-002", title: "Light Cube 户外照明设计", tag: "落地设计/手绘方案", folder: "works/industrial/work-02", count: 12 }),
  createStaticWork({ id: "industrial-003", title: "Mode Bike 电助力车设计", tag: "落地设计/手绘方案", folder: "works/industrial/work-03", count: 17 }),
  createStaticWork({ id: "industrial-004", title: "长城汽车造型设计", tag: "落地设计/手绘方案", folder: "works/industrial/work-04", count: 6 }),
];

const initialAi = [
  createStaticWork({ id: "ai-001", title: "云概念车载机器人设计", tag: "概念/系列迭代设计", folder: "works/ai/work-01", count: 9 }),
  createStaticWork({ id: "ai-002", title: "2D方案延展设计", tag: "概念/系列迭代设计", folder: "works/ai/work-02", count: 6 }),
  createStaticWork({ id: "ai-003", title: "小米空气净化器概念设计", tag: "概念/系列迭代设计", folder: "works/ai/work-03", count: 16 }),
  createStaticWork({ id: "ai-004", title: "空调概念细分设计", tag: "概念/系列迭代设计", folder: "works/ai/work-04", count: 11 }),
];

const initialComfyUiWorks = [
  {
    ...createStaticWork({ id: "comfyui-001", title: "ComfyUI 工作流作品集", tag: "ComfyUI", folder: "works/comfyui/work-01", count: 16 }),
    coverUrl: DEFAULT_COMFYUI_COVER,
    images: [
      { id: "comfyui-001-cover", name: "cover.webp", url: DEFAULT_COMFYUI_COVER },
      ...createStaticImages("works/comfyui/work-01", 16, "comfyui-001"),
    ],
  },
];

const workflowSteps = [
  { title: "01 素材收集", text: "围绕目标品类、使用场景与设计概念建立参考样本，区分功能结构、造型语言、CMF与情绪意象，避免素材只停留在表面风格。" },
  { title: "02 造型归纳", text: "从样本中提取比例关系、曲面转折、分件逻辑、交互界面与支撑结构，形成可被描述、比较和复用的设计特征。" },
  { title: "03 数据打标", text: "将抽象概念转译为稳定的视觉标签，建立形态、材质、结构、风格之间的对应关系，提高生成过程的可控性。" },
  { title: "04 LoRA训练", text: "通过小样本训练建立专属生成倾向，使模型在保持发散能力的同时，更接近项目所需的造型边界与审美方向。" },
  { title: "05 出图迭代", text: "以设计判断筛选生成结果，再围绕比例、结构合理性、CMF一致性和展示表达进行二次修正，完成从图像灵感到方案表达的收束。" },
];

function runPortfolioTests() {
  const tests = [
    { name: "hero keywords exist", pass: heroKeywords.length >= 3 },
    { name: "paper graphite industrial theme applied", pass: true },
    { name: "personal meta has contact info", pass: personalMeta.includes("15303341068") && personalMeta.includes("919901815@qq.com") },
    { name: "basic info removed from resume sections", pass: !resumeSections.some((section) => section.title === "基本情况") },
    { name: "resume has extracted work experience", pass: resumeSections.some((section) => section.title.includes("实习")) },
    { name: "work experience is split into separate groups", pass: resumeSections.find((section) => section.title.includes("实习"))?.groups?.length === 2 },
    { name: "resume viewer uses immersive layout", pass: true },
    { name: "resume viewer uses compact light reading mode", pass: true },
    { name: "industrial section has fixed or editable data", pass: Array.isArray(initialIndustrial) },
    { name: "ai section has fixed or editable data", pass: Array.isArray(initialAi) },
    { name: "portfolio viewer uses image gallery mode", pass: true },
    { name: "portfolio viewer is optimized for 16:9 pages", pass: true },
    { name: "portfolio viewer separates main image and thumbnail rail", pass: true },
    { name: "portfolio viewer uses immersive overlay controls", pass: true },
    { name: "portfolio viewer uses full screen direct viewing", pass: true },
    { name: "portfolio viewer auto hides controls while browsing", pass: true },
    { name: "thumbnail rail stays hidden after browsing until image hover", pass: true },
    { name: "thumbnail rail is hidden unless hovering main image", pass: true },
    { name: "portfolio viewer progress indicator removed", pass: true },
    { name: "portfolio viewer corner text minimized", pass: true },
    { name: "portfolio viewer keeps balanced subtle black gallery frame", pass: true },
    { name: "portfolio viewer centers each slide with symmetric gutters", pass: true },
    { name: "portfolio viewer uses single centered stage instead of offset track", pass: true },
    { name: "portfolio viewer keeps only vertical gallery frame", pass: true },
    { name: "thumbnail rail scrollbar is visually hidden", pass: true },
    { name: "uploaded works persist with IndexedDB", pass: typeof savePortfolioSnapshot === "function" && typeof loadPortfolioSnapshot === "function" },
    { name: "uploaded works can be cleared from local storage", pass: typeof deletePortfolioSnapshot === "function" },
    { name: "portfolio cover is managed per work card", pass: true },
    { name: "portfolio cover cards use 16:9 1920x1080 presentation", pass: true },
    { name: "portfolio rename uses custom modal", pass: true },
    { name: "portfolio delete uses custom confirm modal", pass: true },
    { name: "cover replacement requires preview confirmation", pass: true },
    { name: "cover crop supports custom position and zoom", pass: true },
    { name: "cover crop supports mouse wheel zoom", pass: true },
    { name: "workflow has exactly five steps", pass: workflowSteps.length === 5 },
    { name: "workflow section uses horizontal process map", pass: true },
    { name: "workflow cards open visual explanation modal", pass: true },
    { name: "intro gate exists before entering website", pass: typeof IntroGate === "function" },
    { name: "portfolio management controls are hidden in preview mode", pass: true },
    { name: "workflow section has no grid overlay", pass: true },
    { name: "all workflow steps have title and text", pass: workflowSteps.every((item) => item.title && item.text) },
    { name: "workflow step numbers are unique", pass: new Set(workflowSteps.map((item) => item.title.slice(0, 2))).size === workflowSteps.length },
  ];
  const failed = tests.filter((test) => !test.pass);
  if (failed.length) console.warn("Portfolio tests failed:", failed.map((item) => item.name));
  return tests;
}

function ResumeTextWindow() {
  return (
    <div className="max-h-[420px] overflow-y-auto pr-2">
      <div className="space-y-4">
        {resumeSections.map((section) => (
          <section key={section.title} className="rounded-[1.5rem] border border-[#1e2a33]/8 bg-[#fbf9f2] p-5 transition hover:bg-white">
            <h3 className="text-base font-semibold tracking-[-0.02em] text-[#1e2a33]">{section.title}</h3>
            {section.groups ? (
              <div className="mt-3 space-y-3">
                {section.groups.map((group) => (
                  <div key={group.company} className="rounded-[1rem] bg-white/55 px-4 py-3">
                    <p className="text-sm font-semibold text-[#1e2a33]">{group.company} · {group.role}</p>
                    <p className="mt-1 text-xs text-[#8c969f]">{group.period}</p>
                    <div className="mt-2 space-y-1.5">
                      {group.points.map((point, index) => (
                        <p key={`${group.company}-${index}`} className="text-sm leading-7 text-[#52606b]">{point}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              section.title === "教育背景" ? (
                <div className="mt-4 grid gap-2 text-sm md:grid-cols-[1.05fr_1.15fr_1fr] md:items-center">
                  <span className="flex items-center font-normal text-[#687783]">
                    <span>2021.09</span>
                    <span className="mx-2 h-px w-4 shrink-0 bg-[#c8d0d6]" aria-hidden="true" />
                    <span>2025.06</span>
                  </span>
                  <span className="font-normal text-[#687783]">华北理工大学（全日制）</span>
                  <span className="font-normal text-[#687783] md:text-right">产品设计（本科）</span>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {section.items.map((item, index) => (
                    <p key={`${section.title}-${index}`} className="text-sm leading-7 text-[#52606b]">{item}</p>
                  ))}
                </div>
              )
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function FileUploadCard({ onUpload, label }) {
  return (
    <label className="group relative block cursor-pointer overflow-hidden rounded-[2rem] border border-white/70 bg-white/58 shadow-[0_18px_50px_rgba(30,42,51,0.06)] backdrop-blur-xl transition duration-300 hover:-translate-y-[2px] hover:shadow-[0_26px_70px_rgba(30,42,51,0.10)]">
      <input type="file" multiple accept="image/*" className="hidden" onChange={onUpload} />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at top left, rgba(255,255,255,0.88), transparent 42%), linear-gradient(135deg, rgba(255,255,255,0.72), rgba(232,238,242,0.46))",
        }}
      />

      <div className="relative p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1e2a33] text-white shadow-lg shadow-[#1e2a33]/15">
            <Icon name="upload" className="h-5 w-5" />
          </div>
          <span className="rounded-full border border-[#1e2a33]/8 bg-white/72 px-3 py-1 text-[11px] font-medium text-[#73808a]">16:9 · 1920×1080</span>
        </div>

        <div className="overflow-hidden rounded-[1.45rem] border border-[#1e2a33]/8 bg-[#eef2f4] p-3">
          <div className="flex aspect-[16/9] items-center justify-center rounded-[1.1rem] border border-dashed border-[#1e2a33]/12 bg-white/55">
            <div className="text-center">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[#1e2a33]">{label}</p>
              <p className="mt-2 text-sm leading-6 text-[#6c7882]">上传后自动生成沉浸式封面卡片</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-[#85919b]">
          <span>建议上传横版作品图</span>
          <span>点击整张区域上传</span>
        </div>
      </div>
    </label>
  );
}

function WorkCard({ item, onOpen, onCoverUpload, onRename, onDelete, isEditMode = false, isDragging = false, isDragOver = false, onDragStart, onDragEnter, onDragOver, onDrop, onDragEnd }) {
  const coverImage = item.coverUrl || item.images?.[0]?.url || "";
  const coverFit = item.coverFit || "cover";
  const coverCrop = item.coverCrop || { x: 50, y: 50, scale: 1 };

  return (
    <article
      draggable={isEditMode}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group relative overflow-hidden rounded-[2rem] bg-transparent shadow-[0_18px_50px_rgba(30,42,51,0.06)] transition duration-300 hover:-translate-y-[2px] hover:shadow-[0_24px_62px_rgba(30,42,51,0.10)] ${isEditMode ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "scale-[0.98] opacity-55 ring-2 ring-[#1e2a33]/18" : ""} ${isDragOver ? "ring-4 ring-[#1e2a33]/10" : ""}`}
    >
      <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[2rem] bg-transparent [clip-path:inset(0_round_2rem)]">
          {coverImage ? (
            <div className="absolute inset-[-1px]" style={{ filter: "brightness(1.08) contrast(1.03) saturate(1.02)" }}>
              <CoverImage
                src={coverImage}
                alt={item.title}
                fit={coverFit}
                crop={coverCrop}
                className="h-full w-full transition duration-700 group-hover:scale-[1.015]"
              />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Icon name="gallery" className="h-12 w-12 text-[#1e2a33]/35" />
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/46 via-black/12 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
            <h3 className="max-w-[82%] text-[1.7rem] font-semibold tracking-[-0.05em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.28)] md:text-[2rem]">{item.title}</h3>
          </div>
        </div>
      </button>

      {isEditMode ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-white/18 bg-black/22 px-3 py-1.5 text-[11px] font-medium text-white/82 opacity-0 backdrop-blur-md transition duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          长按拖拽排序
        </div>
      ) : null}

      {isEditMode ? (
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex translate-y-1 gap-2 opacity-0 transition duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
          <label className="cursor-pointer rounded-full border border-white/20 bg-black/24 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-black/38">
            <input type="file" accept="image/*" className="hidden" onChange={(event) => onCoverUpload(item, event)} />
            更换封面
          </label>
          <button type="button" onClick={() => onRename(item)} className="rounded-full border border-white/20 bg-black/24 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-black/38">重命名</button>
          <button type="button" onClick={() => onDelete(item)} className="rounded-full border border-white/18 bg-[#8f2f2f]/82 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-[#7c2424]">删除</button>
        </div>
      ) : null}
    </article>
  );
}

function PortfolioViewerModal({ item, currentIndex, onSelectIndex, onPrev, onNext, onClose }) {
  const images = item?.images || [];
  const safeIndex = images.length ? Math.min(currentIndex, images.length - 1) : 0;
  const currentImage = images[safeIndex];
  const [dragStartX, setDragStartX] = useState(null);
  const [cleanMode, setCleanMode] = useState(false);
  const [isAutoImmersive, setIsAutoImmersive] = useState(false);
  const [hasStartedBrowsing, setHasStartedBrowsing] = useState(false);
  const [isImageHovering, setIsImageHovering] = useState(false);
  const restoreTimerRef = useRef(null);
  const wheelLockRef = useRef(false);

  function scheduleUiRestore(delay = 1400) {
    if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
    restoreTimerRef.current = window.setTimeout(() => {
      setIsAutoImmersive(false);
    }, delay);
  }

  function triggerAutoImmersive(delay = 1500) {
    setHasStartedBrowsing(true);
    setIsAutoImmersive(true);
    scheduleUiRestore(delay);
  }

  function endDrag(clientX) {
    if (dragStartX === null) return;
    const delta = clientX - dragStartX;
    if (Math.abs(delta) > 55) {
      triggerAutoImmersive(1500);
      if (delta > 0) onPrev();
      if (delta < 0) onNext();
    } else {
      scheduleUiRestore(700);
    }
    setDragStartX(null);
  }

  function handleWheelNavigate(event) {
    if (images.length <= 1) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 12) return;

    event.preventDefault();
    triggerAutoImmersive(1500);

    if (wheelLockRef.current) return;
    wheelLockRef.current = true;
    if (delta > 0) onNext();
    if (delta < 0) onPrev();

    window.setTimeout(() => {
      wheelLockRef.current = false;
    }, 420);
  }

  useEffect(() => {
    function handleImmersiveKeyDown(event) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") triggerAutoImmersive(1500);
    }
    window.addEventListener("keydown", handleImmersiveKeyDown);
    return () => window.removeEventListener("keydown", handleImmersiveKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (restoreTimerRef.current) window.clearTimeout(restoreTimerRef.current);
    };
  }, []);

  const hideTopUi = cleanMode || isAutoImmersive;
  const shouldShowThumbnailRail = !cleanMode && !isAutoImmersive && isImageHovering;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white">
      <div
        className={`group relative h-screen w-screen overflow-hidden ${cleanMode ? "cursor-none" : ""}`}
        onDoubleClick={() => setCleanMode((value) => !value)}
        onWheel={handleWheelNavigate}
        onMouseDown={(event) => setDragStartX(event.clientX)}
        onMouseUp={(event) => endDrag(event.clientX)}
        onMouseLeave={(event) => endDrag(event.clientX)}
        onTouchStart={(event) => setDragStartX(event.touches[0]?.clientX ?? null)}
        onTouchEnd={(event) => endDrag(event.changedTouches[0]?.clientX ?? 0)}
      >
        <div className={`pointer-events-none absolute right-5 top-5 z-30 flex items-center gap-2 transition-all duration-300 md:right-7 md:top-7 ${hideTopUi ? "-translate-y-2 opacity-0" : "translate-y-0 opacity-100"}`}>
          <button
            onClick={onClose}
            aria-label="关闭作品集浏览"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-black/18 text-white/68 backdrop-blur transition hover:bg-black/40 hover:text-white"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {cleanMode ? (
          <button
            onClick={() => setCleanMode(false)}
            aria-label="显示控件"
            className="absolute right-6 top-5 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/8 bg-black/14 text-white/24 opacity-0 backdrop-blur transition hover:bg-black/40 hover:text-white group-hover:opacity-100"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </button>
        ) : null}

        <div className="relative flex h-full w-full items-center justify-center bg-black py-3 md:py-5">
          {images.length ? (
            <div
              className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black"
              onMouseEnter={() => setIsImageHovering(true)}
              onMouseLeave={() => setIsImageHovering(false)}
            >
              {images.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerAutoImmersive(1500);
                    onPrev();
                  }}
                  className="absolute left-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-black/18 text-white/55 opacity-0 backdrop-blur transition duration-300 hover:bg-black/40 hover:text-white group-hover:opacity-100 md:left-5"
                >
                  <span className="text-2xl leading-none">‹</span>
                </button>
              ) : null}

              <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black px-3 py-4 md:px-8 md:py-6">
                {currentImage ? (
                  <div
                    className="relative aspect-[16/9] w-[min(98vw,1920px)] max-h-[calc(100vh-64px)] overflow-hidden rounded-[1.2rem] bg-black shadow-[0_30px_110px_rgba(0,0,0,0.64)]"
                    style={{ width: "min(98vw, calc((100vh - 64px) * 16 / 9), 1920px)" }}
                  >
                    <img
                      key={currentImage.id}
                      src={currentImage.url}
                      alt={currentImage.name}
                      className="block h-full w-full select-none object-contain"
                      draggable="false"
                      onError={handleImageFallback}
                    />
                  </div>
                ) : null}
              </div>

              {images.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerAutoImmersive(1500);
                    onNext();
                  }}
                  className="absolute right-3 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/8 bg-black/18 text-white/55 opacity-0 backdrop-blur transition duration-300 hover:bg-black/40 hover:text-white group-hover:opacity-100 md:right-5"
                >
                  <span className="text-2xl leading-none">›</span>
                </button>
              ) : null}

              {images.length > 1 ? (
                <div className={`absolute bottom-5 left-1/2 z-20 w-[calc(100%-40px)] max-w-[1100px] -translate-x-1/2 rounded-[1.4rem] border border-white/8 bg-black/22 px-3 py-3 backdrop-blur-md transition-all duration-300 ${shouldShowThumbnailRail ? "translate-y-0 opacity-90" : "translate-y-8 opacity-0 pointer-events-none"}`}>
                  <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {images.map((image, index) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => {
                          triggerAutoImmersive(1200);
                          onSelectIndex(index);
                        }}
                        className={`group/thumb relative shrink-0 overflow-hidden rounded-[0.95rem] border transition ${safeIndex === index ? "border-white/45 opacity-100" : "border-white/8 opacity-45 hover:border-white/20 hover:opacity-85"}`}
                      >
                        <div className="aspect-[16/9] w-[122px] overflow-hidden bg-[#091018] md:w-[150px]">
                          <img src={image.url} alt={image.name} className="h-full w-full object-contain transition duration-300 group-hover/thumb:scale-[1.02]" onError={handleImageFallback} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-white/45">当前作品集暂无图片</div>
          )}
        </div>

      </div>
    </div>
  );
}

function IntroGate({ onEnter }) {
  return (
    <div className="fixed inset-0 z-[90] overflow-hidden bg-[#edf1f3]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(20,28,34,0.014) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20,28,34,0.012) 1px, transparent 1px),
            radial-gradient(circle at 18% 18%, rgba(255,255,255,0.92), transparent 28rem),
            radial-gradient(circle at 84% 16%, rgba(196,208,216,0.24), transparent 30rem),
            linear-gradient(135deg, #eef2f4 0%, #e8edef 56%, #dde4e8 100%)
          `,
          backgroundSize: "52px 52px, 52px 52px, auto, auto, auto",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-20 h-[420px] w-[420px] rounded-full bg-white/58 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-[-70px] h-[360px] w-[420px] rounded-full bg-[#d3dde2]/45 blur-3xl" />

      <div className="relative flex min-h-screen items-center justify-center px-6 py-8">
        <div className="w-full max-w-3xl rounded-[1.9rem] border border-white/65 bg-white/44 shadow-[0_18px_60px_rgba(24,33,42,0.06)] backdrop-blur-xl transition duration-500">
          <div className="relative overflow-hidden rounded-[1.9rem] px-8 py-12 md:px-14 md:py-16">

            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1e2a33] text-sm font-semibold text-white shadow-lg shadow-[#1e2a33]/8">卢</span>
                <div className="text-left">
                  <p className="text-sm font-semibold tracking-[-0.02em] text-[#1e2a33]">卢金宇</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.24em] text-[#97a1aa]">Portfolio Entrance</p>
                </div>
              </div>

              <div className="rounded-full border border-[#1e2a33]/6 bg-white/55 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[#94a0aa]">00 / Intro</div>
            </div>

            <div className="mx-auto mt-12 max-w-2xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#9aa5ae]">Opening Note</p>

              <h1 className="mt-5 text-[34px] font-semibold leading-[1.02] tracking-[-0.075em] text-[#1e2a33] md:text-[54px]">
                设计作品集
              </h1>

              <p className="mx-auto mt-6 max-w-lg text-[15px] leading-8 text-[#5a6772] md:text-[16px]">聚焦落地设计、概念探索与 AI 介入设计流程。</p>
            </div>

            <div className="mt-14 flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-[0.28em] text-[#9eabb4]">Enter Portfolio</span>

              <div className="mt-4 flex items-center gap-4">
                <span className="h-px w-10 bg-[#1e2a33]/10" />
                <button onClick={onEnter} className="group inline-flex items-center gap-3 rounded-full bg-[#1e2a33] px-8 py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(30,42,51,0.10)] transition duration-300 hover:-translate-y-[1px] hover:bg-[#33414d] hover:shadow-[0_16px_36px_rgba(30,42,51,0.14)]">
                  <span>进入网站</span>
                  <span className="transition duration-300 group-hover:translate-x-0.5">→</span>
                </button>
                <span className="h-px w-10 bg-[#1e2a33]/10" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowSketchGraphic() {
  return (
    <div className="mt-6 max-w-[260px] md:max-w-[290px] lg:max-w-[320px] -ml-2 -translate-y-1">
      <div className="relative aspect-square w-full">
        <svg viewBox="0 0 900 900" className="h-full w-full overflow-visible drop-shadow-[0_18px_32px_rgba(0,0,0,0.22)]" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="草图到成品的概念设计流程图">
          <defs>
            <linearGradient id="workflowMetal" x1="420" y1="600" x2="670" y2="790" gradientUnits="userSpaceOnUse">
              <stop stopColor="#F5F7F8" />
              <stop offset="0.28" stopColor="#B9C0C7" />
              <stop offset="0.62" stopColor="#636B75" />
              <stop offset="1" stopColor="#222A32" />
            </linearGradient>
            <linearGradient id="workflowBlue" x1="210" y1="360" x2="420" y2="590" gradientUnits="userSpaceOnUse">
              <stop stopColor="#69B3FF" />
              <stop offset="1" stopColor="#277EF0" />
            </linearGradient>
            <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.74">
            <path d="M150 255C200 280 296 277 350 250" />
            <path d="M182 224C244 255 312 252 350 224" opacity="0.45" />
            <path d="M230 230C216 152 232 76 302 42C356 74 374 118 356 180C344 212 323 239 298 260" />
            <path d="M300 49C315 125 303 197 272 255" opacity="0.42" />
            <path d="M352 120C318 168 310 212 315 260" opacity="0.36" />
            <path d="M178 252C177 274 181 291 190 304C260 322 323 316 380 292C373 276 365 263 352 250" opacity="0.45" />
            <path d="M210 245L360 230M226 270L378 260M238 90L350 188M220 156L318 252" opacity="0.22" />
          </g>

          <path d="M358 178C430 146 500 151 563 197" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
          <path d="M550 166L563 197L530 196" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />

          <g transform="translate(465 78) rotate(8 150 150)" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.76">
            <path d="M32 215C82 241 178 238 232 211" />
            <path d="M64 184C126 215 194 212 232 184" opacity="0.45" />
            <path d="M112 190C98 112 114 36 184 2C238 34 256 78 238 140C226 172 205 199 180 220" />
            <path d="M182 9C197 85 185 157 154 215" opacity="0.42" />
            <path d="M234 80C200 128 192 172 197 220" opacity="0.36" />
            <path d="M60 212C59 234 63 251 72 264C142 282 205 276 262 252C255 236 247 223 234 210" opacity="0.45" />
            <path d="M92 205L242 190M108 230L260 220M120 50L232 148M102 116L200 212" opacity="0.22" />
          </g>

          <path d="M432 324C360 348 303 392 268 456" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
          <path d="M258 424L268 456L295 434" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />

          <g transform="translate(150 405) rotate(-6 145 145)" stroke="url(#workflowBlue)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#softGlow)">
            <path d="M34 210C82 238 178 238 232 210" />
            <path d="M64 180C126 214 194 212 232 184" opacity="0.65" />
            <path d="M112 188C96 110 114 36 184 0C238 34 257 82 238 142C226 176 204 200 180 222" />
            <path d="M182 8C198 84 184 158 153 216" opacity="0.55" />
            <path d="M234 80C198 130 192 174 196 222" opacity="0.5" />
            <path d="M60 212C60 232 64 250 74 262C142 280 205 276 260 252C254 235 247 222 234 210" opacity="0.65" />
            <path d="M92 205L242 190M108 230L260 220M120 50L232 148M102 116L200 212M126 82L232 80M125 132L226 132M120 170L218 178" opacity="0.42" />
          </g>

          <path d="M402 498C490 475 590 495 665 555" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" opacity="0.52" />
          <path d="M632 562L665 555L650 526" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.52" />

          <g transform="translate(570 380) rotate(8 145 145)" stroke="#CFE8FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" filter="url(#softGlow)">
            <path d="M34 210C82 238 178 238 232 210" />
            <path d="M64 180C126 214 194 212 232 184" opacity="0.6" />
            <path d="M112 188C96 110 114 36 184 0C238 34 257 82 238 142C226 176 204 200 180 222" />
            <path d="M182 8C198 84 184 158 153 216" opacity="0.45" />
            <path d="M234 80C198 130 192 174 196 222" opacity="0.42" />
            <path d="M60 212C60 232 64 250 74 262C142 280 205 276 260 252C254 235 247 222 234 210" opacity="0.56" />
            <path d="M92 205L242 190M108 230L260 220M120 50L232 148M102 116L200 212M78 190L238 88M82 228L240 150" opacity="0.28" />
          </g>

          <path d="M728 690C703 750 656 792 596 815" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" opacity="0.54" />
          <path d="M624 826L596 815L620 796" stroke="#DCE3E8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.54" />

          <g transform="translate(320 610)">
            <ellipse cx="180" cy="226" rx="150" ry="25" fill="#000" opacity="0.16" />
            <path d="M145 25C212 45 252 92 244 160C238 206 202 252 164 274C119 255 92 216 80 160C67 96 92 46 145 25Z" fill="url(#workflowMetal)" stroke="#E7EEF5" strokeWidth="3" />
            <path d="M121 50C154 62 183 82 202 118C188 164 168 212 137 245C102 220 90 178 86 138C82 96 94 68 121 50Z" fill="#121C26" opacity="0.86" stroke="#253545" strokeWidth="3" />
            <path d="M210 93C236 137 230 188 194 235" stroke="#111827" strokeWidth="10" opacity="0.5" />
            <path d="M98 190C128 208 170 208 194 186" stroke="#78C4FF" strokeWidth="4" opacity="0.85" />
            <path d="M145 25C176 62 180 125 154 226" stroke="#fff" strokeWidth="5" opacity="0.45" />
            <path d="M70 246C120 272 205 270 264 242L306 266C228 315 103 310 28 270L70 246Z" fill="url(#workflowMetal)" stroke="#2D3640" strokeWidth="3" />
            <path d="M86 248C140 268 203 266 260 244" stroke="#F7FAFC" strokeWidth="4" opacity="0.35" />
          </g>
        </svg>
      </div>
    </div>
  );
}

function WorkflowVisual({ type }) {
  const commonText = "#DCE8EF";
  const muted = "#8FA9BA";
  const dark = "#24303A";
  const mid = "#526875";

  if (type === "collect") {
    return (
      <svg viewBox="0 0 420 280" className="h-full w-full" fill="none" aria-label="素材收集示意图">
        <rect x="34" y="42" width="88" height="92" rx="18" fill="#33414D" />
        <rect x="146" y="42" width="88" height="92" rx="18" fill="#41515F" />
        <rect x="258" y="42" width="128" height="92" rx="18" fill="#5E7383" />
        <rect x="70" y="164" width="280" height="72" rx="20" fill="#1F2A33" stroke={muted} strokeWidth="2" />
        <circle cx="78" cy="74" r="10" fill="#AFC6D5" />
        <circle cx="190" cy="82" r="15" fill="#DCE8EF" />
        <circle cx="312" cy="83" r="18" fill="#C5D8E3" />
        <path d="M122 194H304" stroke={commonText} strokeWidth="3" strokeLinecap="round" />
        <path d="M122 214H250" stroke={muted} strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "extract") {
    return (
      <svg viewBox="0 0 420 280" className="h-full w-full" fill="none" aria-label="造型归纳示意图">
        <rect x="48" y="48" width="130" height="184" rx="24" fill={dark} stroke={muted} strokeWidth="2" />
        <path d="M90 178C132 142 136 106 126 70C156 96 176 138 176 178C176 194 148 214 124 214C100 214 76 198 76 182C76 166 80 156 90 178Z" fill={commonText} fillOpacity="0.9" />
        <rect x="228" y="66" width="138" height="34" rx="14" fill="#3E4E5C" />
        <rect x="228" y="116" width="116" height="34" rx="14" fill="#566B79" />
        <rect x="228" y="166" width="96" height="34" rx="14" fill="#7E96A5" />
        <path d="M178 138H220" stroke="#B7CCD8" strokeWidth="3" strokeLinecap="round" />
        <path d="M212 130L226 138L212 146" stroke="#B7CCD8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (type === "define") {
    return (
      <svg viewBox="0 0 420 280" className="h-full w-full" fill="none" aria-label="数据打标示意图">
        <rect x="52" y="54" width="136" height="172" rx="24" fill={dark} />
        <rect x="234" y="54" width="134" height="48" rx="16" fill={mid} />
        <rect x="234" y="118" width="110" height="48" rx="16" fill="#6D8595" />
        <rect x="234" y="182" width="86" height="48" rx="16" fill="#8EA9B9" />
        <path d="M98 94H142" stroke={commonText} strokeWidth="4" strokeLinecap="round" />
        <path d="M88 122H152" stroke="#AFC6D5" strokeWidth="4" strokeLinecap="round" />
        <path d="M88 150H136" stroke="#AFC6D5" strokeWidth="4" strokeLinecap="round" />
        <path d="M188 78H224" stroke="#BBD0DB" strokeWidth="3" strokeLinecap="round" />
        <path d="M188 140H224" stroke="#BBD0DB" strokeWidth="3" strokeLinecap="round" />
        <path d="M188 204H224" stroke="#BBD0DB" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (type === "train") {
    return (
      <svg viewBox="0 0 420 280" className="h-full w-full" fill="none" aria-label="模型训练示意图">
        <circle cx="84" cy="78" r="18" fill="#8EA9B9" />
        <circle cx="84" cy="142" r="18" fill="#8EA9B9" />
        <circle cx="84" cy="206" r="18" fill="#8EA9B9" />
        <circle cx="210" cy="94" r="22" fill={mid} />
        <circle cx="210" cy="190" r="22" fill={mid} />
        <circle cx="336" cy="142" r="26" fill={commonText} />
        <path d="M102 78L188 94M102 142L188 94M102 206L188 190M232 94L310 142M232 190L310 142" stroke="#AFC6D5" strokeWidth="3" />
        <rect x="144" y="230" width="132" height="18" rx="9" fill={dark} />
        <rect x="144" y="230" width="86" height="18" rx="9" fill="#9BB5C4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 420 280" className="h-full w-full" fill="none" aria-label="出图迭代示意图">
      <rect x="54" y="54" width="312" height="172" rx="26" fill={dark} />
      <rect x="86" y="88" width="248" height="18" rx="9" fill="#425260" />
      <rect x="86" y="122" width="214" height="18" rx="9" fill="#6B8494" />
      <rect x="86" y="156" width="182" height="18" rx="9" fill="#9CB6C5" />
      <rect x="86" y="190" width="144" height="18" rx="9" fill={commonText} />
      <path d="M306 166L336 140" stroke={commonText} strokeWidth="3" strokeLinecap="round" />
      <path d="M336 140L352 156" stroke={commonText} strokeWidth="3" strokeLinecap="round" />
      <path d="M336 140L322 124" stroke={commonText} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function WorkflowSection({ mode, setMode, comfyUiWorks, comfyUiCoverUrl, onUploadComfyUi, onUploadComfyUiCover, onOpenComfyWork, onComfyCoverUpload = () => {}, onComfyRename = () => {}, onComfyDelete = () => {}, editMode }) {
  const [activeStep, setActiveStep] = useState(null);
  const workflowItems = [
    {
      id: "collect",
      number: "01",
      keyword: "Input",
      title: "素材收集",
      text: "围绕目标品类、使用场景与设计概念建立参考样本，区分功能结构、造型语言、CMF与情绪意象，避免素材只停留在表面风格。",
      action: "建立目标样本",
      output: "形成有边界的设计资料库",
      simpleText: "这一步不是随便找图，而是先把真正和项目相关的参考整理出来，让后面的设计方向更清楚。",
      bullets: ["收集竞品、场景、材质与意向图片", "区分结构参考与情绪参考", "删除无关或质量较低的素材"],
      visual: "collect",
    },
    {
      id: "extract",
      number: "02",
      keyword: "Extract",
      title: "造型归纳",
      text: "从样本中提取比例关系、曲面转折、分件逻辑、交互界面与支撑结构，形成可被描述、比较和复用的设计特征。",
      action: "提取造型规律",
      output: "沉淀可复用的形态特征",
      simpleText: "这一步是把灵感变成规则，从大量参考中总结出真正适合项目的造型语言。",
      bullets: ["分析比例、轮廓与曲面关系", "提炼分件、结构和界面特征", "总结可持续复用的造型语言"],
      visual: "extract",
    },
    {
      id: "define",
      number: "03",
      keyword: "Define",
      title: "数据打标",
      text: "将抽象概念转译为稳定的视觉标签，建立形态、材质、结构、风格之间的对应关系，提高生成过程的可控性。",
      action: "构建语义标签",
      output: "提升图像生成的可控性",
      simpleText: "把图片内容翻译成 AI 能理解的语言，这样模型才知道什么该保留、什么该强化。",
      bullets: ["标注造型、结构、材质和风格", "建立清晰的标签层级", "减少无效词，提高控制精度"],
      visual: "define",
    },
    {
      id: "train",
      number: "04",
      keyword: "Train",
      title: "LoRA训练",
      text: "通过小样本训练建立专属生成倾向，使模型在保持发散能力的同时，更接近项目所需的造型边界与审美方向。",
      action: "训练专属倾向",
      output: "获得更稳定的风格响应",
      simpleText: "通过训练，让模型逐渐靠近你的设计语言，减少随机性，提高生成结果的一致性。",
      bullets: ["控制数据量与样本质量", "测试不同训练轮次与权重", "观察结果并反向修正数据集"],
      visual: "train",
    },
    {
      id: "refine",
      number: "05",
      keyword: "Refine",
      title: "出图迭代",
      text: "以设计判断筛选生成结果，再围绕比例、结构合理性、CMF一致性和展示表达进行二次修正，完成从图像灵感到方案表达的收束。",
      action: "设计判断回收",
      output: "完成从发散到方案的收束",
      simpleText: "AI生成只是起点，真正的设计价值在于筛选、判断和继续优化，直到方案可以清楚表达。",
      bullets: ["筛选更有潜力的方向", "继续调整比例、结构与细节", "整理成可展示、可汇报的方案"],
      visual: "refine",
    },
  ];

  const latestComfyCover = comfyUiCoverUrl || comfyUiWorks[0]?.coverUrl || comfyUiWorks[0]?.images?.[0]?.url || "";

  return (
    <section id="workflow" className="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20">
      <div className="relative overflow-hidden rounded-[3rem] border border-[#1e2a33]/12 bg-[#24303a] shadow-[0_28px_80px_rgba(24,33,42,0.18)]">
        <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-[#8aa6b8]/14 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-170px] left-[-120px] h-80 w-[34rem] rounded-full bg-[#516878]/14 blur-3xl" />

        <div className="relative p-7 md:p-10 lg:p-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div className="max-w-4xl">
              <div className="mb-5 flex items-center gap-3">
                <span className="h-px w-10 bg-[#b7c5cf]/35" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#b8c4cc]">Section 03 · Concept Workflow</p>
              </div>
              <h2 className="text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-white md:text-6xl">
                {mode === "cover" ? "AI概念设计工作流" : mode === "webui" ? "WebUI 概念设计流程" : "ComfyUI 工作流作品"}
              </h2>
              <p className="mt-6 max-w-2xl text-base leading-7 text-[#d7e0e6]/80">
                {mode === "cover" ? "WebUI，ComfyUI为生成式AI主要的使用平台，在此我结合我的理解分别设计了两套不同的工作流程，进行展示。" : mode === "webui" ? "保留概念设计中的素材归纳、数据打标、LoRA训练与出图迭代逻辑，用流程化方式展示 WebUI 在设计中的介入方法。" : "ComfyUI 作为并列模块，以作品集上传与浏览为主，直接呈现工作流产出的视觉成果。"}
              </p>
            </div>

            {mode !== "cover" ? (
              <button
                type="button"
                onClick={() => setMode("cover")}
                className="inline-flex items-center gap-2 self-start rounded-full border border-white/12 bg-white/[0.08] px-5 py-3 text-sm font-medium text-white/86 transition hover:bg-white/[0.12] md:self-end"
              >
                <span>←</span>
                <span>返回模块入口</span>
              </button>
            ) : null}
          </div>

          {mode === "cover" ? (
            <div className="mt-12 grid gap-7 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("webui")}
                className="group relative min-h-[420px] overflow-hidden rounded-[2.55rem] border border-[rgba(255,255,255,0.13)] bg-[#2a3742] text-left shadow-[0_22px_68px_rgba(0,0,0,0.20)] transition duration-300 hover:-translate-y-1 hover:border-[rgba(255,255,255,0.22)] hover:shadow-[0_28px_86px_rgba(0,0,0,0.26)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.065),transparent_48%),radial-gradient(circle_at_16%_14%,rgba(210,226,236,0.13),transparent_34%)]" />

                <div className="relative flex h-full flex-col p-7 md:p-9">
                  <div className="pt-[6px]">
                    <h3 className="text-5xl font-semibold leading-[0.9] tracking-[-0.075em] text-white md:text-[4.5rem]">WebUI</h3>
                    <p className="mt-4 text-[15px] font-medium text-white/64">概念设计流程</p>
                  </div>

                  <div className="relative mt-9 aspect-[16/9] w-full overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.10)] bg-[#1f2a33]/52 px-6 py-6">
                    <div className="relative h-full w-full">
                      <div className="absolute left-[7%] right-[7%] top-[48%] h-px bg-white/18" />
                      <div className="absolute left-[7%] right-[7%] top-[48%] h-[10px] -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.035),transparent)]" />

                      {[
                        { n: "1", t: "素材", left: "8%" },
                        { n: "2", t: "归纳", left: "29%" },
                        { n: "3", t: "打标", left: "50%" },
                        { n: "4", t: "训练", left: "71%" },
                        { n: "5", t: "迭代", left: "92%" },
                      ].map((item, index) => (
                        <div key={item.n} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: item.left, top: "48%" }}>
                          <div className="flex flex-col items-center text-center">
                            <div
                              className={`mb-3 flex items-center justify-center rounded-full border text-sm font-semibold shadow-[0_10px_26px_rgba(0,0,0,0.16)] transition ${index === 2 ? "h-12 w-12 border-[rgba(255,255,255,0.24)] bg-[rgba(255,255,255,0.11)] text-white" : "h-11 w-11 border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] text-white/86 group-hover:border-[rgba(255,255,255,0.22)] group-hover:bg-[rgba(255,255,255,0.09)]"}`}
                            >
                              {item.n}
                            </div>
                            <div className="mb-3 h-5 w-px bg-white/12" />
                            <p className={`whitespace-nowrap text-[11px] tracking-[-0.01em] ${index === 2 ? "text-white/70" : "text-white/56"}`}>{item.t}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-7 flex items-end justify-between gap-5">
                    <div className="border-t border-[rgba(255,255,255,0.12)] pt-4">
                      <p className="text-sm font-medium text-white/78">进入流程 →</p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.055)] text-xl text-white/64 transition group-hover:translate-x-1 group-hover:bg-[rgba(255,255,255,0.095)] group-hover:text-white">→</div>
                  </div>
                </div>
              </button>

              <article
                role="button"
                tabIndex={0}
                onClick={() => setMode("comfyui")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setMode("comfyui");
                }}
                className="group relative min-h-[420px] cursor-pointer overflow-hidden rounded-[2.55rem] border border-[rgba(255,255,255,0.13)] bg-[#2a3742] text-left shadow-[0_22px_68px_rgba(0,0,0,0.20)] transition duration-300 hover:-translate-y-1 hover:border-[rgba(255,255,255,0.22)] hover:shadow-[0_28px_86px_rgba(0,0,0,0.26)]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),transparent_48%),radial-gradient(circle_at_18%_14%,rgba(210,226,236,0.13),transparent_34%)]" />

                {editMode ? (
                  <label
                    onClick={(event) => event.stopPropagation()}
                    className="absolute right-7 top-7 z-30 cursor-pointer rounded-full border border-[rgba(255,255,255,0.16)] bg-black/22 px-3.5 py-2 text-xs font-medium text-white/82 backdrop-blur-md transition hover:bg-black/34"
                  >
                    <input type="file" accept="image/*" className="hidden" onChange={onUploadComfyUiCover} />
                    上传小封面
                  </label>
                ) : null}

                <div className="relative flex h-full flex-col p-7 md:p-9">
                  <div className="pt-[6px]">
                    <h3 className="text-5xl font-semibold leading-[0.9] tracking-[-0.075em] text-white md:text-[4.5rem]">ComfyUI</h3>
                    <p className="mt-4 text-[15px] font-medium text-white/64">工作流作品浏览</p>
                  </div>

                  <div className="mt-9 aspect-[16/9] w-full overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.12)] bg-[#1f2a33]/72 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
                    {latestComfyCover ? (
                      <div className="relative h-full w-full overflow-hidden">
                        <img
                          src={latestComfyCover}
                          alt="ComfyUI作品封面"
                          className="h-full w-full object-contain transition duration-700 group-hover:scale-[1.01]"
                          onError={handleImageFallback}
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent" />
                      </div>
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center px-8 text-center">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.045)] text-white/44">
                          <Icon name="gallery" className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-medium text-white/72">ComfyUI 小封面</p>
                        <p className="mt-2 max-w-xs text-xs leading-5 text-white/38">进入编辑模式可单独上传这里的封面。</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-7 flex items-end justify-between gap-5">
                    <div className="border-t border-[rgba(255,255,255,0.12)] pt-4">
                      <p className="text-sm font-medium text-white/78">浏览作品 →</p>
                      <p className="mt-1 text-xs leading-5 text-white/38">当前 {comfyUiWorks.length} 组作品</p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.055)] text-xl text-white/64 transition group-hover:translate-x-1 group-hover:bg-[rgba(255,255,255,0.095)] group-hover:text-white">→</div>
                  </div>
                </div>
              </article>
            </div>
          ) : null}

          {mode === "webui" ? (
            <div className="mt-10">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-medium text-[#edf3f7]">Process Map</p>
              </div>

              <div className="relative rounded-[2rem] border border-white/10 bg-[#1f2a33]/72 p-4 md:p-5">
                <div className="pointer-events-none absolute left-8 right-8 top-[4.15rem] hidden h-px bg-gradient-to-r from-transparent via-white/18 to-transparent lg:block" />
                <div className="grid gap-4 lg:grid-cols-5">
                  {workflowItems.map((item, index) => (
                    <button key={item.id} type="button" onClick={() => setActiveStep(item)} className="group relative flex h-full flex-col rounded-[1.55rem] border border-[#dce8ef]/16 bg-[#2a3742] p-5 text-left shadow-[0_14px_38px_rgba(0,0,0,0.12)] transition duration-300 hover:-translate-y-[2px] hover:border-[#d4e4ef]/30 hover:bg-[#33414d]">
                      <div className="mb-5 flex items-center justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#17212a] text-sm font-semibold text-white shadow-[0_10px_26px_rgba(0,0,0,0.18)]">{item.number}</div>
                        {index < workflowItems.length - 1 ? <span className="hidden text-lg text-white/28 lg:block">→</span> : null}
                      </div>

                      <div>
                        <span className="inline-flex rounded-full border border-[#dce8ef]/22 bg-[#dce8ef]/14 px-3 py-1 text-[10px] font-semibold tracking-[0.18em] text-[#f2f8fb]">{item.keyword}</span>
                        <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-white">{item.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-[#edf4f8]/88">{item.text}</p>
                      </div>

                      <div className="mt-auto pt-5">
                        <div className="border-t border-[#dce8ef]/16 pt-4">
                          <div className="grid gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b9cbd7]/76">Action</p>
                              <p className="mt-1 text-sm leading-6 text-[#f0f6fa]">{item.action}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b9cbd7]/76">Output</p>
                              <p className="mt-1 text-sm leading-6 text-[#f0f6fa]">{item.output}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {mode === "comfyui" ? (
            <div className="mt-10">
              {editMode ? (
                <div className="mb-7 grid gap-4 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:items-stretch">
                  <FileUploadCard label="上传 ComfyUI 作品集" onUpload={onUploadComfyUi} />
                  <div className="flex flex-col justify-between rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 text-white/72 shadow-xl shadow-black/10 backdrop-blur">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/36">ComfyUI Manage</p>
                      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">作品集维护</h3>
                      <p className="mt-3 max-w-lg text-sm leading-7 text-white/54">上传作品集后，可在每张卡片右上角单独更换作品集封面、重命名或删除。封面会同步用于入口小封面的缩略预览。</p>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">{comfyUiWorks.length} 组作品</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">16:9 封面展示</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5">本地自动缓存</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {comfyUiWorks.length ? (
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {comfyUiWorks.map((work) => {
                    const coverImage = work.coverUrl || work.images?.[0]?.url || "";
                    return (
                      <article key={work.id} className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] text-left shadow-xl shadow-black/10 backdrop-blur transition hover:-translate-y-1 hover:bg-white/[0.08]">
                        <button type="button" onClick={() => onOpenComfyWork(work)} className="block w-full text-left">
                          <div className="relative aspect-[16/9] overflow-hidden bg-[#182129]">
                            {coverImage ? (
                              <img src={coverImage} alt={work.title} className="h-full w-full object-contain transition duration-700 group-hover:scale-[1.01]" onError={handleImageFallback} />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center">
                                <Icon name="gallery" className="h-10 w-10 text-white/35" />
                              </div>
                            )}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[34%] bg-gradient-to-t from-black/38 via-black/10 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-4">
                              <h4 className="max-w-[90%] text-lg font-semibold tracking-[-0.03em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.28)]">{work.title}</h4>
                              <p className="mt-1 text-xs text-white/46">{work.images?.length || 0} 张图片 · 点击浏览</p>
                            </div>
                          </div>
                        </button>

                        {editMode ? (
                          <div className="pointer-events-none absolute right-4 top-4 z-20 flex translate-y-1 gap-2 opacity-0 transition duration-300 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:translate-y-0 group-focus-within:opacity-100">
                            <label onClick={(event) => event.stopPropagation()} className="cursor-pointer rounded-full border border-white/20 bg-black/28 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-black/42">
                              <input type="file" accept="image/*" className="hidden" onChange={(event) => onComfyCoverUpload(work, event)} />
                              上传封面
                            </label>
                            <button type="button" onClick={(event) => { event.stopPropagation(); onComfyRename(work); }} className="rounded-full border border-white/20 bg-black/28 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-black/42">重命名</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); onComfyDelete(work); }} className="rounded-full border border-white/18 bg-[#8f2f2f]/82 px-3 py-2 text-xs font-medium text-white backdrop-blur-md transition hover:bg-[#7c2424]">删除</button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-[2rem] border border-dashed border-white/14 bg-white/[0.04] p-10 text-center text-white/55">
                  <p className="text-base">{editMode ? "请上传 ComfyUI 作品集。" : "ComfyUI 作品正在整理中。"}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {activeStep ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl overflow-hidden rounded-[2.2rem] border border-white/10 bg-[#f7f5ef] shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between border-b border-[#1e2a33]/10 px-6 py-5 md:px-8">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.28em] text-[#8c969f]">{activeStep.keyword}</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[#1e2a33] md:text-3xl">{activeStep.number} · {activeStep.title}</h3>
              </div>
              <button onClick={() => setActiveStep(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e2a33] text-white transition hover:bg-[#33414d]">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[76vh] overflow-y-auto md:grid-cols-[1.02fr_0.98fr]">
              <div className="flex items-center justify-center bg-[#111b23] p-6 md:p-8">
                <div className="w-full max-w-[460px] rounded-[1.8rem] border border-white/10 bg-[#1d2932] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
                  <div className="aspect-[16/9] w-full overflow-hidden rounded-[1.2rem] bg-[#16212a]">
                    <WorkflowVisual type={activeStep.visual} />
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8">
                <p className="text-base leading-8 text-[#52606b]">{activeStep.simpleText}</p>
                <div className="mt-6 grid gap-3">
                  {activeStep.bullets.map((point) => (
                    <div key={point} className="rounded-[1.2rem] border border-[#1e2a33]/10 bg-white/70 px-4 py-3">
                      <p className="text-sm leading-7 text-[#52606b]">{point}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-[1.4rem] border border-[#1e2a33]/10 bg-[#fbfaf6] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8c969f]">Action</p>
                  <p className="mt-1 text-sm leading-7 text-[#52606b]">{activeStep.action}</p>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8c969f]">Output</p>
                  <p className="mt-1 text-sm leading-7 text-[#52606b]">{activeStep.output}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function DesignPortfolioWebsite() {
  useEffect(() => {
    runPortfolioTests();
  }, []);

  const [introAccepted, setIntroAccepted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editPasswordOpen, setEditPasswordOpen] = useState(false);
  const [editPasswordDraft, setEditPasswordDraft] = useState("");
  const [editPasswordError, setEditPasswordError] = useState("");
  const [resumeOpen, setResumeOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
  const [avatarFileName, setAvatarFileName] = useState("");
  const [qrUrl, setQrUrl] = useState(DEFAULT_QR);
  const [industrialWorks, setIndustrialWorks] = useState(initialIndustrial);
  const [aiWorks, setAiWorks] = useState(initialAi);
  const [workflowMode, setWorkflowMode] = useState("cover");
  const [comfyUiWorks, setComfyUiWorks] = useState(initialComfyUiWorks);
  const [comfyUiCoverUrl, setComfyUiCoverUrl] = useState(DEFAULT_COMFYUI_COVER);
  const [activeWorks, setActiveWorks] = useState("industrial");
  const [draggingWorkId, setDraggingWorkId] = useState(null);
  const [dragOverWorkId, setDragOverWorkId] = useState(null);
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState(null);
  const [portfolioViewerIndex, setPortfolioViewerIndex] = useState(0);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [coverPreviewTarget, setCoverPreviewTarget] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [coverPreviewFileName, setCoverPreviewFileName] = useState("");
  const [coverPreviewFit, setCoverPreviewFit] = useState("custom");
  const [coverPreviewCropX, setCoverPreviewCropX] = useState(50);
  const [coverPreviewCropY, setCoverPreviewCropY] = useState(50);
  const [coverPreviewScale, setCoverPreviewScale] = useState(1);
  const [coverDragStart, setCoverDragStart] = useState(null);
  const [storageReady, setStorageReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState("正在读取本地作品缓存…");

  function handleAvatarUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("请上传图片格式的头像，例如 JPG、PNG 或 WEBP。");
      event.target.value = "";
      return;
    }
    readFileAsDataUrl(file, (dataUrl) => {
      if (!dataUrl) {
        alert("头像读取失败，请重新选择图片。");
        return;
      }
      setAvatarUrl(dataUrl);
      setAvatarFileName(file.name);
    });
  }

  function handleQrUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("请上传图片格式的二维码，例如 JPG、PNG 或 WEBP。");
      event.target.value = "";
      return;
    }
    readFileAsDataUrl(file, (dataUrl) => {
      if (!dataUrl) {
        alert("二维码读取失败，请重新选择图片。");
        return;
      }
      setQrUrl(dataUrl);
    });
  }

  function updateWorkCover(item, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("请上传图片格式的封面。");
      event.target.value = "";
      return;
    }
    readFileAsDataUrl(file, (dataUrl) => {
      if (!dataUrl) {
        alert("封面读取失败，请重新选择图片。");
        return;
      }
      setCoverPreviewTarget(item);
      setCoverPreviewUrl(dataUrl);
      setCoverPreviewFileName(file.name);
      setCoverPreviewFit(item.coverFit || "custom");
      setCoverPreviewCropX(item.coverCrop?.x ?? 50);
      setCoverPreviewCropY(item.coverCrop?.y ?? 50);
      setCoverPreviewScale(item.coverCrop?.scale ?? 1);
    });
    event.target.value = "";
  }

  function applyCoverPreview() {
    if (!coverPreviewTarget || !coverPreviewUrl) return;
    const nextCrop = { x: coverPreviewCropX, y: coverPreviewCropY, scale: coverPreviewScale };
    const updater = (prev) => prev.map((item) => item.id === coverPreviewTarget.id ? { ...item, coverUrl: coverPreviewUrl, coverFit: coverPreviewFit, coverCrop: nextCrop } : item);
    setIndustrialWorks(updater);
    setAiWorks(updater);
    setComfyUiWorks(updater);
    setSelectedPortfolioItem((prev) => prev?.id === coverPreviewTarget.id ? { ...prev, coverUrl: coverPreviewUrl, coverFit: coverPreviewFit, coverCrop: nextCrop } : prev);
    cancelCoverPreview();
  }

  function cancelCoverPreview() {
    setCoverPreviewTarget(null);
    setCoverPreviewUrl("");
    setCoverPreviewFileName("");
    setCoverPreviewFit("custom");
    setCoverPreviewCropX(50);
    setCoverPreviewCropY(50);
    setCoverPreviewScale(1);
    setCoverDragStart(null);
  }

  function handleCoverPreviewWheel(event) {
    if (coverPreviewFit !== "custom") return;
    event.preventDefault();
    const step = event.deltaY < 0 ? 0.08 : -0.08;
    setCoverPreviewScale((prev) => clampNumber(Number((prev + step).toFixed(2)), 1, 2.2));
  }

  function uploadWorks(section, event) {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (!imageFiles.length) {
      alert("请至少选择一张图片文件。当前作品集查看器已改为纯图片浏览模式。");
      event.target.value = "";
      return;
    }

    const portfolioId = `${section}-${Date.now()}`;
    const loadedImages = new Array(imageFiles.length);
    let loadedCount = 0;

    imageFiles.forEach((file, index) => {
      readFileAsDataUrl(file, (dataUrl) => {
        if (dataUrl) {
          loadedImages[index] = {
            id: `${portfolioId}-img-${index}`,
            name: file.name,
            url: dataUrl,
          };
        }

        loadedCount += 1;
        if (loadedCount === imageFiles.length) {
          const validImages = loadedImages.filter(Boolean);
          if (!validImages.length) {
            alert("图片读取失败，请重新上传。");
            return;
          }

          const item = {
            id: portfolioId,
            title: validImages.length === 1 ? imageFiles[0].name.replace(/\.[^/.]+$/, "") : `${section === "industrial" ? "落地设计/手绘方案" : "概念/系列迭代设计"} ${new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
            desc: `共 ${validImages.length} 张作品图片，点击可在大窗口中滑动查看。`,
            tag: section === "industrial" ? "落地设计/手绘方案" : "概念/系列迭代设计",
            type: "upload",
            coverUrl: "",
            images: validImages,
          };

          if (section === "industrial") setIndustrialWorks((prev) => [item, ...prev]);
          if (section === "ai") setAiWorks((prev) => [item, ...prev]);
        }
      });
    });
    event.target.value = "";
  }

  function updateComfyWorkCover(targetWork, event) {
    const file = event.target.files?.[0];
    if (!file || !targetWork) return;
    if (!file.type.startsWith("image/")) {
      alert("请上传图片格式的作品集封面。");
      event.target.value = "";
      return;
    }

    readFileAsDataUrl(file, (dataUrl) => {
      if (!dataUrl) {
        alert("作品集封面读取失败，请重新选择图片。");
        return;
      }

      const updater = (prev) => prev.map((work) => work.id === targetWork.id ? { ...work, coverUrl: dataUrl, coverFit: "cover", coverCrop: { x: 50, y: 50, scale: 1 } } : work);
      setComfyUiWorks(updater);
      setSelectedPortfolioItem((prev) => prev?.id === targetWork.id ? { ...prev, coverUrl: dataUrl, coverFit: "cover", coverCrop: { x: 50, y: 50, scale: 1 } } : prev);
    });

    event.target.value = "";
  }

  function uploadComfyUiCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("请上传图片格式的 ComfyUI 小封面。");
      event.target.value = "";
      return;
    }
    readFileAsDataUrl(file, (dataUrl) => {
      if (!dataUrl) {
        alert("ComfyUI 小封面读取失败，请重新选择图片。");
        return;
      }
      setComfyUiCoverUrl(dataUrl);
    });
    event.target.value = "";
  }

  function uploadComfyUiWorks(event) {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (!imageFiles.length) {
      alert("请至少选择一张图片文件。ComfyUI 模块以图片作品集形式进行浏览。");
      event.target.value = "";
      return;
    }

    const portfolioId = `comfyui-${Date.now()}`;
    const loadedImages = new Array(imageFiles.length);
    let loadedCount = 0;

    imageFiles.forEach((file, index) => {
      readFileAsDataUrl(file, (dataUrl) => {
        if (dataUrl) {
          loadedImages[index] = {
            id: `${portfolioId}-img-${index}`,
            name: file.name,
            url: dataUrl,
          };
        }

        loadedCount += 1;
        if (loadedCount === imageFiles.length) {
          const validImages = loadedImages.filter(Boolean);
          if (!validImages.length) {
            alert("图片读取失败，请重新上传。");
            return;
          }

          const item = {
            id: portfolioId,
            title: validImages.length === 1 ? imageFiles[0].name.replace(/\.[^/.]+$/, "") : `ComfyUI 作品集 ${new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
            desc: `共 ${validImages.length} 张图片`,
            tag: "ComfyUI",
            type: "comfyui-upload",
            coverUrl: validImages[0]?.url || "",
            images: validImages,
          };

          setComfyUiWorks((prev) => [item, ...prev]);
        }
      });
    });
    event.target.value = "";
  }

  function openPortfolioViewer(item) {
    setSelectedPortfolioItem(item);
    setPortfolioViewerIndex(0);
  }

  function closePortfolioViewer() {
    setSelectedPortfolioItem(null);
    setPortfolioViewerIndex(0);
  }

  function goPrevPortfolioImage() {
    if (!selectedPortfolioItem?.images?.length) return;
    setPortfolioViewerIndex((prev) => prev === 0 ? selectedPortfolioItem.images.length - 1 : prev - 1);
  }

  function goNextPortfolioImage() {
    if (!selectedPortfolioItem?.images?.length) return;
    setPortfolioViewerIndex((prev) => prev === selectedPortfolioItem.images.length - 1 ? 0 : prev + 1);
  }

  function handleWorkRename(item) {
    setRenameTarget(item);
    setRenameDraft(item.title || "");
  }

  function applyWorkRename() {
    const nextTitle = renameDraft.trim();
    if (!renameTarget || !nextTitle) return;
    const updater = (prev) => prev.map((work) => work.id === renameTarget.id ? { ...work, title: nextTitle } : work);
    setIndustrialWorks(updater);
    setAiWorks(updater);
    setComfyUiWorks(updater);
    setSelectedPortfolioItem((prev) => prev?.id === renameTarget.id ? { ...prev, title: nextTitle } : prev);
    setRenameTarget(null);
    setRenameDraft("");
  }

  function cancelWorkRename() {
    setRenameTarget(null);
    setRenameDraft("");
  }

  function handleWorkDelete(item) {
    setDeleteTarget(item);
  }

  function confirmWorkDelete() {
    if (!deleteTarget) return;
    const workId = deleteTarget.id;
    setIndustrialWorks((prev) => prev.filter((work) => work.id !== workId));
    setAiWorks((prev) => prev.filter((work) => work.id !== workId));
    setComfyUiWorks((prev) => prev.filter((work) => work.id !== workId));
    setSelectedPortfolioItem((prev) => prev?.id === workId ? null : prev);
    setDeleteTarget(null);
  }

  function cancelWorkDelete() {
    setDeleteTarget(null);
  }

  useEffect(() => {
    if (!USE_LOCAL_CACHE) {
      setIndustrialWorks(initialIndustrial);
      setAiWorks(initialAi);
      setComfyUiWorks(initialComfyUiWorks);
      setComfyUiCoverUrl(DEFAULT_COMFYUI_COVER);
      setWorkflowMode("cover");
      setAvatarUrl(DEFAULT_AVATAR);
      setAvatarFileName("");
      setQrUrl(DEFAULT_QR);
      setActiveWorks("industrial");
      setStorageStatus(CANVAS_PREVIEW ? "画布预览模式：请用编辑模式上传图片预览；上线时关闭 CANVAS_PREVIEW 读取 public/works" : "上线固定资料已启用，默认读取 public/works 图片");
      setStorageReady(true);
      return;
    }

    let cancelled = false;
    async function restoreCachedPortfolio() {
      try {
        const snapshot = await loadPortfolioSnapshot();
        if (cancelled) return;
        if (snapshot) {
          setIndustrialWorks(Array.isArray(snapshot.industrialWorks) ? snapshot.industrialWorks : []);
          setAiWorks(Array.isArray(snapshot.aiWorks) ? snapshot.aiWorks : []);
          setComfyUiWorks(Array.isArray(snapshot.comfyUiWorks) ? snapshot.comfyUiWorks : []);
          setComfyUiCoverUrl(snapshot.comfyUiCoverUrl || "");
          setWorkflowMode(["cover", "webui", "comfyui"].includes(snapshot.workflowMode) ? snapshot.workflowMode : "cover");
          setAvatarUrl(snapshot.avatarUrl || DEFAULT_AVATAR);
          setAvatarFileName(snapshot.avatarFileName || "");
          setQrUrl(snapshot.qrUrl || DEFAULT_QR);
          setActiveWorks(snapshot.activeWorks === "ai" ? "ai" : "industrial");
          setStorageStatus("已恢复上次上传的作品缓存");
        } else {
          setStorageStatus("本地缓存已启用，上传后会自动保留");
        }
      } catch (error) {
        console.warn("Local portfolio cache unavailable:", error);
        if (!cancelled) setStorageStatus("本地缓存不可用，刷新后可能需要重新上传");
      } finally {
        if (!cancelled) setStorageReady(true);
      }
    }
    restoreCachedPortfolio();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!USE_LOCAL_CACHE) return;
    if (!storageReady) return;
    const timer = window.setTimeout(async () => {
      try {
        await savePortfolioSnapshot({ industrialWorks, aiWorks, comfyUiWorks, comfyUiCoverUrl, workflowMode, avatarUrl, avatarFileName, qrUrl, activeWorks });
        setStorageStatus("作品已自动保存到本地缓存");
      } catch (error) {
        console.warn("Failed to persist portfolio cache:", error);
        setStorageStatus("自动保存失败，图片过大时可减少单次上传数量");
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [storageReady, industrialWorks, aiWorks, comfyUiWorks, comfyUiCoverUrl, workflowMode, avatarUrl, avatarFileName, qrUrl, activeWorks]);

  async function clearLocalPortfolioCache() {
    const confirmed = window.confirm(USE_LOCAL_CACHE ? "确定清空本地缓存吗？这会移除当前页面保存的作品、头像和二维码缓存。" : "是否恢复默认内容？");
    if (!confirmed) return;
    if (!USE_LOCAL_CACHE) {
      setIndustrialWorks(initialIndustrial);
      setAiWorks(initialAi);
      setComfyUiWorks(initialComfyUiWorks);
      setComfyUiCoverUrl(DEFAULT_COMFYUI_COVER);
      setWorkflowMode("cover");
      setAvatarUrl(DEFAULT_AVATAR);
      setAvatarFileName("");
      setQrUrl(DEFAULT_QR);
      setSelectedPortfolioItem(null);
      setStorageStatus("已恢复上线固定内容");
      return;
    }
    try {
      await deletePortfolioSnapshot();
      setIndustrialWorks(initialIndustrial);
      setAiWorks(initialAi);
      setComfyUiWorks(initialComfyUiWorks);
      setComfyUiCoverUrl(DEFAULT_COMFYUI_COVER);
      setWorkflowMode("cover");
      setAvatarUrl(DEFAULT_AVATAR);
      setAvatarFileName("");
      setQrUrl(DEFAULT_QR);
      setSelectedPortfolioItem(null);
      setStorageStatus("本地缓存已清空");
    } catch (error) {
      console.warn("Failed to clear portfolio cache:", error);
      setStorageStatus("清空缓存失败，请刷新后重试");
    }
  }

  useEffect(() => {
    if (!selectedPortfolioItem) return;
    function handleKeyDown(event) {
      if (event.key === "Escape") closePortfolioViewer();
      if (event.key === "ArrowLeft") goPrevPortfolioImage();
      if (event.key === "ArrowRight") goNextPortfolioImage();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPortfolioItem]);

  const currentWorks = activeWorks === "industrial" ? industrialWorks : aiWorks;
  const visibleWorks = currentWorks;

  function reorderWorks(fromId, toId) {
    if (!editMode || !fromId || !toId || fromId === toId) return;
    const reorder = (items) => {
      const fromIndex = items.findIndex((item) => item.id === fromId);
      const toIndex = items.findIndex((item) => item.id === toId);
      if (fromIndex < 0 || toIndex < 0) return items;
      const nextItems = [...items];
      const [movedItem] = nextItems.splice(fromIndex, 1);
      nextItems.splice(toIndex, 0, movedItem);
      return nextItems;
    };
    if (activeWorks === "industrial") setIndustrialWorks(reorder);
    if (activeWorks === "ai") setAiWorks(reorder);
  }

  function handleWorkDragStart(item, event) {
    if (!editMode) return;
    setDraggingWorkId(item.id);
    setDragOverWorkId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", item.id);
  }

  function handleWorkDragOver(item, event) {
    if (!editMode || !draggingWorkId || draggingWorkId === item.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverWorkId(item.id);
  }

  function handleWorkDrop(item, event) {
    if (!editMode) return;
    event.preventDefault();
    const sourceId = draggingWorkId || event.dataTransfer.getData("text/plain");
    reorderWorks(sourceId, item.id);
    setDraggingWorkId(null);
    setDragOverWorkId(null);
  }

  function handleWorkDragEnd() {
    setDraggingWorkId(null);
    setDragOverWorkId(null);
  }

  function handleIntroEnter() {
    setIntroAccepted(true);
  }

  function handleIntroReview() {
    setIntroAccepted(false);
  }

  function handleEditModeButton() {
    if (editMode) {
      setEditMode(false);
      return;
    }
    setEditPasswordOpen(true);
    setEditPasswordDraft("");
    setEditPasswordError("");
  }

  function submitEditPassword() {
    if (editPasswordDraft.trim() === EDIT_MODE_PASSWORD) {
      setEditMode(true);
      setEditPasswordOpen(false);
      setEditPasswordDraft("");
      setEditPasswordError("");
      return;
    }
    setEditPasswordError("密码不正确，请重新输入。");
  }

  function cancelEditPassword() {
    setEditPasswordOpen(false);
    setEditPasswordDraft("");
    setEditPasswordError("");
  }

  return (
    <div className="industrial-paper min-h-screen bg-[#eceff1] text-[#18212a]">
      <style>{`
        .industrial-paper {
          background:
            linear-gradient(rgba(24, 33, 42, 0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(24, 33, 42, 0.032) 1px, transparent 1px),
            radial-gradient(circle at 82% -12%, rgba(153, 171, 184, 0.30), transparent 34rem),
            radial-gradient(circle at 8% 18%, rgba(255, 255, 255, 0.82), transparent 30rem),
            linear-gradient(135deg, #eef1f3 0%, #e2e7ea 48%, #d7dde2 100%);
          background-size: 42px 42px, 42px 42px, auto, auto, auto;
          color: #18212a;
        }

        .industrial-paper [class*="bg-[#f5f1e8]"],
        .industrial-paper [class*="bg-[#f3efe6]"],
        .industrial-paper [class*="bg-[#f8f6ef]"],
        .industrial-paper [class*="bg-[#f7f4ed]"],
        .industrial-paper [class*="bg-[#fcfbf7]"],
        .industrial-paper [class*="bg-[#fbf9f2]"],
        .industrial-paper [class*="bg-[#eef0eb]"],
        .industrial-paper [class*="bg-[#ebe4d6]"] {
          background-color: rgba(248, 250, 251, 0.72) !important;
        }

        .industrial-paper [class*="bg-white/"],
        .industrial-paper [class~="bg-white"],
        .industrial-paper [class*="bg-white "] {
          background-color: rgba(255, 255, 255, 0.68) !important;
        }


        .industrial-paper [class*="from-[#d7e8f5]"],
        .industrial-paper [class*="from-[#eaf3f8]"],
        .industrial-paper [class*="from-[#f8f7f2]"] {
          --tw-gradient-from: rgba(238, 243, 246, 0.96) var(--tw-gradient-from-position) !important;
          --tw-gradient-to: rgba(238, 243, 246, 0) var(--tw-gradient-to-position) !important;
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
        }

        .industrial-paper [class*="via-[#f7f6f1]"],
        .industrial-paper [class*="via-[#e7edf1]"],
        .industrial-paper [class*="via-white"] {
          --tw-gradient-stops: var(--tw-gradient-from), rgba(252, 253, 253, 0.96) var(--tw-gradient-via-position), var(--tw-gradient-to) !important;
        }

        .industrial-paper [class*="to-[#d2dde3]"],
        .industrial-paper [class*="to-[#d4e0e6]"],
        .industrial-paper [class*="to-[#cdd8df]"] {
          --tw-gradient-to: rgba(211, 220, 226, 0.96) var(--tw-gradient-to-position) !important;
        }

        .industrial-paper [class*="text-[#1e2a33]"] { color: #18212a !important; }
        .industrial-paper [class*="text-[#52606b]"] { color: #465560 !important; }
        .industrial-paper [class*="text-[#66727d]"],
        .industrial-paper [class*="text-[#5f6b75]"],
        .industrial-paper [class*="text-[#6a7580]"],
        .industrial-paper [class*="text-[#76828c]"],
        .industrial-paper [class*="text-[#7b8790]"],
        .industrial-paper [class*="text-[#8c969f]"],
        .industrial-paper [class*="text-[#97a1aa]"],
        .industrial-paper [class*="text-[#9aa8b2]"] {
          color: #687783 !important;
        }

        .industrial-paper [class*="border-white"],
        .industrial-paper [class*="border-[#1e2a33]"] {
          border-color: rgba(24, 33, 42, 0.11) !important;
        }

        .industrial-paper [class*="shadow-[#1e2a33]"],
        .industrial-paper [class*="shadow-black"] {
          box-shadow: 0 20px 60px rgba(24, 33, 42, 0.10) !important;
        }

        .industrial-paper [class*="bg-[#1e2a33]"] {
          background-color: #1f2a33 !important;
          color: #f7fafb !important;
        }

        .industrial-paper button[class*="bg-[#1e2a33]"],
        .industrial-paper a[class*="bg-[#1e2a33]"],
        .industrial-paper label[class*="bg-[#1e2a33]"] {
          background: linear-gradient(135deg, #1f2a33, #2c3944) !important;
          color: #f7fafb !important;
          border-color: rgba(255, 255, 255, 0.16) !important;
        }

        .industrial-paper button[class*="hover:bg-[#33414d]"]:hover,
        .industrial-paper a[class*="hover:bg-[#33414d]"]:hover,
        .industrial-paper label[class*="hover:bg-[#33414d]"]:hover {
          background: linear-gradient(135deg, #2d3a45, #41515e) !important;
        }

        .industrial-paper [class*="bg-[#f1eee6]"],
        .industrial-paper [class*="bg-[#faf8f3]"] {
          background-color: rgba(247, 249, 250, 0.78) !important;
        }

        .industrial-paper [class*="bg-[#fff1f1]"] {
          background-color: rgba(157, 69, 69, 0.10) !important;
        }

        .industrial-paper .workflow-panel {
          background: linear-gradient(135deg, rgba(39, 51, 61, 0.94), rgba(82, 98, 111, 0.90)) !important;
          border: 1px solid rgba(255,255,255,0.34) !important;
          box-shadow: 0 24px 70px rgba(24, 33, 42, 0.18) !important;
        }

        .industrial-paper .workflow-panel [class*="bg-[#101923]"],
        .industrial-paper .workflow-panel [class*="bg-[#111b25]"],
        .industrial-paper .workflow-panel [class*="bg-white/"] {
          background-color: rgba(255, 255, 255, 0.12) !important;
        }

        .industrial-paper .workflow-panel [class*="text-[#f2f6f8]"],
        .industrial-paper .workflow-panel [class*="text-white"] {
          color: #f7fafb !important;
        }

        .industrial-paper .workflow-panel [class*="text-[#a8b6c1]"],
        .industrial-paper .workflow-panel [class*="text-[#c8d3db]"],
        .industrial-paper .workflow-panel [class*="text-[#8fa0ad]"] {
          color: rgba(241, 246, 248, 0.78) !important;
        }

        .industrial-paper [class*="bg-[#0d141c]"],
        .industrial-paper [class*="bg-[#101923]"],
        .industrial-paper [class*="bg-[#111b25]"] {
          background-color: rgba(37, 49, 60, 0.90) !important;
        }

        .industrial-paper input,
        .industrial-paper textarea {
          background: rgba(255, 255, 255, 0.78) !important;
          color: #18212a !important;
          border-color: rgba(24, 33, 42, 0.14) !important;
        }

        .industrial-paper ::selection { background: rgba(67, 92, 112, 0.20); }
      `}</style>
      {!introAccepted ? <IntroGate onEnter={handleIntroEnter} /> : null}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-36 -top-44 h-[520px] w-[520px] rounded-full bg-white/70 blur-3xl" />
        <div className="absolute left-[-220px] top-48 h-[560px] w-[560px] rounded-full bg-[#dce7ec]/70 blur-3xl" />
        <div className="absolute bottom-[-240px] right-1/4 h-[480px] w-[720px] rounded-full bg-[#d1dbe0]/60 blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/60 bg-[#f5f1e8]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 md:px-10">
          <a href="#home" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#1e2a33] text-white shadow-lg shadow-[#1e2a33]/15">LJY</div>
            <div>
              <p className="text-sm font-semibold tracking-[0.22em]">卢金宇</p>
              <p className="text-xs text-[#66727d]">Industrial Design × AI Workflow</p>
            </div>
          </a>
          
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleIntroReview} className="rounded-full border border-[#1e2a33]/10 bg-white/55 px-4 py-3 text-sm font-medium text-[#52606b] transition hover:bg-white">前言</button>
            <button type="button" onClick={handleEditModeButton} className={`rounded-full border px-4 py-3 text-sm font-medium transition ${editMode ? "border-[#1e2a33]/12 bg-[#1e2a33] text-white" : "border-[#1e2a33]/10 bg-white/55 text-[#52606b] hover:bg-white"}`}>{editMode ? "浏览模式" : "编辑模式"}</button>
          </div>
        </div>
      </header>

      <main className="relative z-10" id="home">
        <section id="profile" className="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20">
          <div className="mb-10 overflow-hidden rounded-[2.6rem] border border-white/70 bg-white/50 p-7 shadow-2xl shadow-[#1e2a33]/8 backdrop-blur-xl md:p-10">
            <div className="relative">
              <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[#dbe7ec]/65 blur-3xl" />
              <div className="pointer-events-none absolute left-1/3 top-8 h-24 w-72 rounded-full bg-white/70 blur-2xl" />
              <div className="relative grid gap-8 md:grid-cols-[1fr_280px] md:items-end">
                <div>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px w-12 bg-[#1e2a33]/15" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#97a1aa]">Personal Portfolio</p>
                  </div>
                  <h1 className="text-5xl font-semibold leading-[0.95] tracking-[-0.065em] text-[#1e2a33] md:text-7xl">设计作品集</h1>
                </div>
                <div className="space-y-2 border-l border-[#1e2a33]/8 pl-6">
                  {heroKeywords.map((item, index) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="h-[3px] w-[3px] rounded-full bg-[#b7c0c7]" />
                      <span className={`text-sm tracking-[0.02em] ${index === 0 ? "font-medium text-[#52606b]" : "text-[#76828c]"}`}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-[0.82fr_1.18fr] md:items-stretch">
            <div className="h-full rounded-[2.5rem] border border-white/70 bg-white/60 p-5 shadow-2xl shadow-[#1e2a33]/8 backdrop-blur-xl">
              <div className="flex h-full flex-col rounded-[2rem] bg-gradient-to-br from-[#d7e8f5] via-[#f7f6f1] to-[#d2dde3] p-5">
                <div className="mx-auto aspect-[4/5] w-full max-w-[300px] shrink-0 overflow-hidden rounded-[1.8rem] border border-white/70 bg-white shadow-xl">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="卢金宇证件头像" className="h-full w-full object-cover transition duration-500" style={{ objectPosition: "center 30%" }} onError={(event) => { if (!handleImageFallback(event)) { setAvatarUrl(""); setAvatarFileName(""); } }} />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#eaf3f8] via-white to-[#d4e0e6] text-[#1e2a33]">
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#1e2a33] text-4xl font-semibold text-white shadow-xl">卢</div>
                      <p className="mt-4 text-lg font-semibold">卢金宇</p>
                      <p className="mt-2 text-sm text-[#66727d]">Industrial Design × AI Workflow</p>
                    </div>
                  )}
                </div>
                <div className="mt-5 flex flex-1 flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-[#1e2a33]">卢金宇</h2>
                      <p className="mt-1 text-sm text-[#66727d]">工业设计 / AI辅助概念设计</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-[#1e2a33] shadow-sm">
                      <Icon name="spark" className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs leading-6 text-[#66727d]">
                    <p>电话 / 微信：15303341068</p>
                    <p>邮箱：919901815@qq.com</p>
                  </div>
                  {editMode ? (
                    <>
                      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-full bg-white/80 px-4 py-3 text-sm font-medium text-[#1e2a33] shadow-sm transition hover:bg-white">
                        <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                        <Icon name="upload" className="h-4 w-4" /> 上传 / 更换头像
                      </label>
                      {avatarFileName ? (
                        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-2 text-xs text-[#47535e]">
                          <span className="min-w-0 truncate">已选择：{avatarFileName}</span>
                          <a href={avatarUrl} target="_blank" rel="noreferrer" className="shrink-0 font-semibold text-[#1e2a33]">预览</a>
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="h-full rounded-[2.5rem] border border-white/70 bg-white/60 p-6 shadow-2xl shadow-[#1e2a33]/8 backdrop-blur-xl md:p-7">
              <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c969f]">Resume</p>
                  <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[#1e2a33]">简历信息</h2>
                </div>
                <button onClick={() => setResumeOpen(true)} className="rounded-full bg-[#1e2a33] px-5 py-3 text-sm text-white transition hover:bg-[#33414d]">放大查看</button>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {personalMeta.map((item) => (
                  <span key={item} className="rounded-full bg-[#f7f4ed] px-3 py-1.5 text-xs text-[#66727d]">{item}</span>
                ))}
              </div>
              <ResumeTextWindow />
            </div>
          </div>
        </section>

        <section id="works" className="mx-auto max-w-7xl px-6 py-14 md:px-10 md:py-20">
          <SectionTitle eyebrow="Portfolio" title="作品集展示" text="作品集板块分为「落地设计/手绘方案」与「概念/系列迭代设计」" />

          <div className="mb-7 flex flex-col gap-4 rounded-[1.8rem] border border-white/70 bg-white/45 p-4 shadow-[0_16px_46px_rgba(30,42,51,0.05)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
            <div className="grid grid-cols-2 gap-2 md:w-[420px]">
              <button onClick={() => setActiveWorks("industrial")} className={`rounded-full px-5 py-3 text-sm font-medium transition ${activeWorks === "industrial" ? "bg-[#1e2a33] text-white shadow-md" : "bg-white/72 text-[#5f6b75] hover:bg-white"}`}>落地设计/手绘方案</button>
              <button onClick={() => setActiveWorks("ai")} className={`rounded-full px-5 py-3 text-sm font-medium transition ${activeWorks === "ai" ? "bg-[#1e2a33] text-white shadow-md" : "bg-white/72 text-[#5f6b75] hover:bg-white"}`}>概念/系列迭代设计</button>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-white/72 px-4 py-2 text-sm text-[#66727d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9aa8b2]" />
              <span>当前展示：{activeWorks === "industrial" ? "落地设计/手绘方案" : "概念/系列迭代设计"}</span>
            </div>
          </div>

          {editMode ? (
            <div className="mb-8 flex flex-col gap-3 rounded-[1.5rem] border border-[#1e2a33]/8 bg-white/35 px-5 py-4 text-xs text-[#7b8790] shadow-sm shadow-[#1e2a33]/3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#8ca68f] shadow-[0_0_0_4px_rgba(140,166,143,0.13)]" />
                <div>
                  <p className="font-medium text-[#52606b]">{CANVAS_PREVIEW ? "画布预览缓存" : USE_LOCAL_CACHE ? "本地作品缓存" : "默认作品数据"}</p>
                  <p className="mt-0.5 text-[#8c969f]">{storageStatus}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button type="button" onClick={clearLocalPortfolioCache} className="self-start rounded-full border border-[#1e2a33]/8 bg-white/70 px-4 py-2 text-xs font-medium text-[#52606b] transition hover:bg-white sm:self-auto">{USE_LOCAL_CACHE ? "清空缓存" : "恢复默认内容"}</button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-2">
            {editMode ? (
              <FileUploadCard
                label={activeWorks === "industrial" ? "上传落地设计/手绘方案" : "上传概念/系列迭代设计"}
                onUpload={(event) => uploadWorks(activeWorks, event)}
              />
            ) : null}
            {visibleWorks.map((item) => (
              <WorkCard
                key={item.id}
                item={item}
                onOpen={openPortfolioViewer}
                onCoverUpload={updateWorkCover}
                onRename={handleWorkRename}
                onDelete={handleWorkDelete}
                isEditMode={editMode}
                isDragging={draggingWorkId === item.id}
                isDragOver={dragOverWorkId === item.id}
                onDragStart={(event) => handleWorkDragStart(item, event)}
                onDragEnter={() => editMode && draggingWorkId !== item.id && setDragOverWorkId(item.id)}
                onDragOver={(event) => handleWorkDragOver(item, event)}
                onDrop={(event) => handleWorkDrop(item, event)}
                onDragEnd={handleWorkDragEnd}
              />
            ))}
          </div>

          {visibleWorks.length === 0 ? (
            <div className="mt-6 rounded-[1.8rem] border border-dashed border-[#1e2a33]/14 bg-white/35 p-8 text-center text-sm leading-7 text-[#66727d]">
              {CANVAS_PREVIEW && !editMode ? "画布预览模式下不会读取 public/works 固定图片。正式部署或本地 Vite 项目中会显示固定资料；如需在画布预览，请进入编辑模式上传图片。" : editMode ? "当前还没有上传作品集。一次选择多张图片，系统会把它们作为一个作品集创建，并支持大窗口滑动浏览。" : "该分类作品正在整理中。"}
            </div>
          ) : null}
        </section>

        <WorkflowSection
          mode={workflowMode}
          setMode={setWorkflowMode}
          comfyUiWorks={comfyUiWorks}
          comfyUiCoverUrl={comfyUiCoverUrl}
          onUploadComfyUi={uploadComfyUiWorks}
          onUploadComfyUiCover={uploadComfyUiCover}
          onOpenComfyWork={openPortfolioViewer}
          onComfyCoverUpload={updateComfyWorkCover}
          onComfyRename={handleWorkRename}
          onComfyDelete={handleWorkDelete}
          editMode={editMode}
        />

        <footer id="contact" className="mx-auto max-w-7xl px-6 pb-14 pt-6 md:px-10 md:pb-20">
          <div className="overflow-hidden rounded-[2.4rem] border border-white/70 bg-white/52 shadow-xl shadow-[#1e2a33]/6 backdrop-blur-xl">
            <div className="relative grid gap-0 md:grid-cols-[1fr_390px]">
              <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-[#dbe7ec]/60 blur-3xl" />
              <div className="pointer-events-none absolute bottom-[-90px] right-20 h-44 w-80 rounded-full bg-white/75 blur-3xl" />
              <div className="relative flex min-h-[250px] flex-col justify-center p-7 md:p-9">
                <div className="max-w-md">
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px w-10 bg-[#1e2a33]/14" />
                    <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#97a1aa]">Contact</p>
                  </div>
                  <h2 className="text-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#1e2a33] md:text-5xl">联系方式</h2>
                  <p className="mt-3 text-sm leading-6 text-[#66727d]">请备注身份及来意</p>
                </div>
                <div className="mt-7 flex max-w-sm items-center gap-3">
                  <span className="h-px flex-1 bg-[#1e2a33]/12" />
                  <span className="h-[5px] w-[5px] rounded-full bg-[#b7c0c7]" />
                  <span className="h-px w-16 bg-[#1e2a33]/6" />
                </div>
              </div>
              <div className="relative border-t border-[#1e2a33]/8 bg-[#f8f6ef]/62 p-5 md:border-l md:border-t-0 md:p-6">
                <div className="flex min-h-[250px] flex-col items-center justify-center rounded-[2rem] border border-[#1e2a33]/10 bg-white/58 p-5 text-center shadow-lg shadow-[#1e2a33]/5 backdrop-blur">
                  <div className="relative rounded-[1.8rem] bg-white p-4 shadow-xl shadow-[#1e2a33]/10 ring-1 ring-[#1e2a33]/8">
                    {qrUrl ? (
                      <img src={qrUrl} alt="联系二维码" className="relative h-48 w-48 rounded-[1.15rem] object-contain [image-rendering:auto]" onError={(event) => { if (!handleImageFallback(event)) setQrUrl(null); }} />
                    ) : (
                      <div className="relative flex h-48 w-48 items-center justify-center rounded-[1.15rem] border border-dashed border-[#1e2a33]/18 bg-[#f8f6ef]/80 text-[#1e2a33]">
                        <Icon name="qr" className="h-16 w-16 opacity-75" />
                      </div>
                    )}
                  </div>
                  {editMode ? (
                    <label className="mt-5 cursor-pointer rounded-full bg-[#1e2a33] px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-[#1e2a33]/12 transition hover:bg-[#33414d]">
                      <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
                      上传二维码
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {selectedPortfolioItem ? (
        <PortfolioViewerModal
          item={selectedPortfolioItem}
          currentIndex={portfolioViewerIndex}
          onSelectIndex={setPortfolioViewerIndex}
          onPrev={goPrevPortfolioImage}
          onNext={goNextPortfolioImage}
          onClose={closePortfolioViewer}
        />
      ) : null}

      {editPasswordOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111a]/58 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-white/20 bg-[#f8f6ef] p-6 shadow-2xl shadow-black/30">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c969f]">Edit Access</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1e2a33]">进入编辑模式</h3>
            <p className="mt-3 text-sm leading-7 text-[#66727d]">请输入编辑密码。通过后才会显示上传、重命名、删除、清空缓存等维护功能。</p>
            <input
              type="password"
              value={editPasswordDraft}
              onChange={(event) => {
                setEditPasswordDraft(event.target.value);
                setEditPasswordError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitEditPassword();
                if (event.key === "Escape") cancelEditPassword();
              }}
              autoFocus
              className="mt-6 w-full rounded-2xl border border-[#1e2a33]/12 bg-white px-4 py-3 text-base text-[#1e2a33] outline-none transition focus:border-[#1e2a33]/35"
              placeholder="请输入密码"
            />
            {editPasswordError ? <p className="mt-3 text-sm text-[#9d4545]">{editPasswordError}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={cancelEditPassword} className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#52606b] transition hover:bg-[#f1eee6]">取消</button>
              <button type="button" onClick={submitEditPassword} className="rounded-full bg-[#1e2a33] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#33414d]">确认进入</button>
            </div>
          </div>
        </div>
      ) : null}

      {renameTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111a]/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/20 bg-[#f8f6ef] p-6 shadow-2xl shadow-black/30">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#8c969f]">Rename Portfolio</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1e2a33]">重命名作品集</h3>
            <input
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyWorkRename();
                if (event.key === "Escape") cancelWorkRename();
              }}
              autoFocus
              className="mt-6 w-full rounded-2xl border border-[#1e2a33]/12 bg-white px-4 py-3 text-base text-[#1e2a33] outline-none transition focus:border-[#1e2a33]/35"
              placeholder="请输入作品集名称"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={cancelWorkRename} className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#52606b] transition hover:bg-[#f1eee6]">取消</button>
              <button type="button" onClick={applyWorkRename} className="rounded-full bg-[#1e2a33] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#33414d]">保存名称</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111a]/60 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/20 bg-[#f8f6ef] p-6 shadow-2xl shadow-black/30">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9d4545]">Delete Portfolio</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#1e2a33]">确认删除作品集？</h3>
            <p className="mt-4 text-sm leading-7 text-[#66727d]">将删除「{deleteTarget.title}」。这是当前页面里的本地数据，删除后需要重新上传。</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={cancelWorkDelete} className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#52606b] transition hover:bg-[#f1eee6]">取消</button>
              <button type="button" onClick={confirmWorkDelete} className="rounded-full bg-[#9d4545] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#843737]">确认删除</button>
            </div>
          </div>
        </div>
      ) : null}

      {coverPreviewTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07111a]/65 p-4 backdrop-blur-md">
          <div className="w-full max-w-5xl overflow-hidden rounded-[2.4rem] border border-white/20 bg-[#f8f6ef] shadow-2xl shadow-black/30">
            <div className="flex items-start justify-between gap-5 border-b border-[#1e2a33]/10 px-7 py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#8c969f]">Cover Preview</p>
                <h3 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#1e2a33]">确认封面展示效果</h3>
                <p className="mt-2 text-sm text-[#66727d]">{coverPreviewTarget.title} · {coverPreviewFileName}</p>
              </div>
              <button onClick={cancelCoverPreview} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e2a33] text-white transition hover:bg-[#33414d]">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[72vh] overflow-y-auto p-7 md:grid-cols-[0.95fr_1.05fr] md:gap-7">
              <div>
                <p className="mb-3 text-sm font-semibold text-[#1e2a33]">封面最终预览（16:9 / 1920×1080）</p>
                <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/70 p-4 shadow-xl shadow-[#1e2a33]/8">
                  <div
                    className={`relative aspect-[16/9] overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-[#f8f7f2] via-[#e7edf1] to-[#cdd8df] ${coverPreviewFit === "custom" ? "cursor-grab active:cursor-grabbing" : ""}`}
                    onWheel={handleCoverPreviewWheel}
                    onPointerDown={(event) => {
                      if (coverPreviewFit !== "custom") return;
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setCoverDragStart({ startX: event.clientX, startY: event.clientY, x: coverPreviewCropX, y: coverPreviewCropY });
                    }}
                    onPointerMove={(event) => {
                      if (!coverDragStart || coverPreviewFit !== "custom") return;
                      const nextX = clampNumber(coverDragStart.x - (event.clientX - coverDragStart.startX) / 3, 0, 100);
                      const nextY = clampNumber(coverDragStart.y - (event.clientY - coverDragStart.startY) / 3, 0, 100);
                      setCoverPreviewCropX(nextX);
                      setCoverPreviewCropY(nextY);
                    }}
                    onPointerUp={() => setCoverDragStart(null)}
                    onPointerCancel={() => setCoverDragStart(null)}
                    onPointerLeave={() => setCoverDragStart(null)}
                  >
                    <CoverImage
                      src={coverPreviewUrl}
                      alt="封面最终预览"
                      fit={coverPreviewFit}
                      crop={{ x: coverPreviewCropX, y: coverPreviewCropY, scale: coverPreviewScale }}
                      className="h-full w-full"
                    />
                    <div className="absolute right-4 top-4 rounded-full border border-white/35 bg-white/75 px-3 py-1 text-xs font-medium text-[#1e2a33] backdrop-blur">最终封面</div>
                    {coverPreviewFit === "custom" ? (
                      <>
                        <div className="pointer-events-none absolute inset-4 rounded-[1.15rem] border border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.03)]" />
                        <div className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur">
                          滚轮缩放 · 拖动调整位置
                        </div>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-4 text-sm leading-6 text-[#66727d]">
                    {coverPreviewFit === "custom" ? "当前为自由选区模式，可直接拖动图片位置，也可以用下方滑杆微调选取区域。" : coverPreviewFit === "cover" ? "当前为填满裁切模式，卡片更统一，但边缘可能被裁掉。" : "当前为完整显示模式，图片不会被裁切，但卡片中可能出现留白。"}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setCoverPreviewFit("custom")}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${coverPreviewFit === "custom" ? "bg-[#1e2a33] text-white" : "bg-white text-[#52606b] hover:bg-[#f1eee6]"}`}
                  >
                    自由选区
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverPreviewFit("cover")}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${coverPreviewFit === "cover" ? "bg-[#1e2a33] text-white" : "bg-white text-[#52606b] hover:bg-[#f1eee6]"}`}
                  >
                    填满裁切
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverPreviewFit("contain")}
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${coverPreviewFit === "contain" ? "bg-[#1e2a33] text-white" : "bg-white text-[#52606b] hover:bg-[#f1eee6]"}`}
                  >
                    完整显示
                  </button>
                </div>

                {coverPreviewFit === "custom" ? (
                  <div className="mt-5 rounded-[1.5rem] border border-[#1e2a33]/10 bg-white/70 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#1e2a33]">自由选区微调</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCoverPreviewCropX(50);
                          setCoverPreviewCropY(50);
                          setCoverPreviewScale(1);
                        }}
                        className="rounded-full bg-[#f1eee6] px-3 py-1.5 text-xs font-medium text-[#52606b] transition hover:bg-white"
                      >
                        居中重置
                      </button>
                    </div>
                    <label className="block text-xs font-medium text-[#66727d]">
                      左右位置
                      <input type="range" min="0" max="100" value={coverPreviewCropX} onChange={(event) => setCoverPreviewCropX(Number(event.target.value))} className="mt-2 w-full accent-[#1e2a33]" />
                    </label>
                    <label className="mt-4 block text-xs font-medium text-[#66727d]">
                      上下位置
                      <input type="range" min="0" max="100" value={coverPreviewCropY} onChange={(event) => setCoverPreviewCropY(Number(event.target.value))} className="mt-2 w-full accent-[#1e2a33]" />
                    </label>
                    <label className="mt-4 block text-xs font-medium text-[#66727d]">
                      放大比例：{coverPreviewScale.toFixed(2)}x
                      <input type="range" min="1" max="2.2" step="0.01" value={coverPreviewScale} onChange={(event) => setCoverPreviewScale(Number(event.target.value))} className="mt-2 w-full accent-[#1e2a33]" />
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="mt-7 md:mt-0">
                <p className="mb-3 text-sm font-semibold text-[#1e2a33]">原图完整预览</p>
                <div className="flex min-h-[360px] items-center justify-center rounded-[2rem] bg-[#101923] p-5 shadow-inner shadow-black/25">
                  <img src={coverPreviewUrl} alt="原图完整预览" className="max-h-[520px] max-w-full rounded-[1.4rem] object-contain shadow-2xl shadow-black/30" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-[#1e2a33]/10 px-7 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-[#66727d]">建议上传 1920×1080 横版封面，并将主体放在画面中央。所有作品卡片都会按 16:9 比例展示。</p>
              <div className="flex shrink-0 justify-end gap-3">
                <button type="button" onClick={cancelCoverPreview} className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-[#52606b] transition hover:bg-[#f1eee6]">取消</button>
                <button type="button" onClick={applyCoverPreview} className="rounded-full bg-[#1e2a33] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#33414d]">确认使用封面</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {resumeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/88 p-4 backdrop-blur-[2px]">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-[-240px] h-[520px] w-[780px] -translate-x-1/2 rounded-full bg-white/8 blur-3xl" />
            <div className="absolute bottom-[-220px] right-[-160px] h-[420px] w-[620px] rounded-full bg-[#8aa6b8]/10 blur-3xl" />
          </div>

          <div className="relative flex h-[90vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[2.2rem] border border-white/10 bg-[#f8f6ef]/96 shadow-[0_34px_110px_rgba(0,0,0,0.56)] backdrop-blur-xl">
            <div className="flex shrink-0 items-center justify-between gap-5 border-b border-[#1e2a33]/8 bg-[#f8f6ef]/96 px-6 py-4 md:px-7">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-[#97a1aa]">Resume Viewer</p>
                <h3 className="mt-1 truncate text-2xl font-semibold tracking-[-0.045em] text-[#1e2a33]">卢金宇 · 简历信息</h3>
              </div>
              <button onClick={() => setResumeOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1e2a33] text-white shadow-md shadow-[#1e2a33]/12 transition hover:bg-[#33414d]">
                <Icon name="close" className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fcfbf7]/96 px-6 py-6 md:px-10 md:py-9">
              <div className="mx-auto max-w-[860px]">
                <div className="mb-8 overflow-hidden rounded-[1.8rem] border border-[#1e2a33]/7 bg-white/88 px-7 py-7 shadow-[0_10px_30px_rgba(30,42,51,0.05)] md:px-8 md:py-8">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-5">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.45rem] bg-[#1e2a33] text-3xl font-semibold text-white shadow-lg shadow-[#1e2a33]/12">
                        {avatarUrl ? <img src={avatarUrl} alt="卢金宇头像" className="h-full w-full object-cover transition duration-500" style={{ objectPosition: "center 30%" }} onError={handleImageFallback} /> : "卢"}
                      </div>
                      <div>
                        <h2 className="text-[2rem] font-semibold tracking-[-0.06em] text-[#1e2a33] md:text-[2.3rem]">卢金宇</h2>
                        <p className="mt-2 text-[15px] leading-7 text-[#66727d]">工业设计 / AI辅助概念设计</p>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm leading-6 text-[#52606b] md:text-right">
                      <p>{personalMeta[0]} · {personalMeta[1]}</p>
                      <p>{personalMeta[2]}</p>
                      <p>{personalMeta[5]}</p>
                      <p>{personalMeta[6]}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6 md:space-y-7">
                  {resumeSections.map((section, sectionIndex) => (
                    <section key={section.title} className="overflow-hidden rounded-[1.7rem] border border-[#1e2a33]/7 bg-white/88 shadow-[0_8px_24px_rgba(30,42,51,0.04)]">
                      <div className="px-6 pb-0 pt-6 md:px-8 md:pt-7">
                        <div className="flex items-center gap-4">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#9aa8b2]">{String(sectionIndex + 1).padStart(2, "0")}</span>
                          <h3 className="text-[1.45rem] font-semibold tracking-[-0.05em] text-[#1e2a33] md:text-[1.7rem]">{section.title}</h3>
                        </div>
                        <div className="mt-5 h-px w-full bg-[#c8d0d6]/70" />
                      </div>

                      <div className="px-6 pb-7 pt-6 md:px-8 md:pb-8 md:pt-7">
                        {section.groups ? (
                          <div className="space-y-4">
                            {section.groups.map((group, groupIndex) => (
                              <div key={`${section.title}-${group.company}`} className={`${groupIndex === 0 ? "" : "border-t border-[#1e2a33]/8 pt-6"}`}>
                                <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
                                  <div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9aa8b2]">EXP {String(groupIndex + 1).padStart(2, "0")}</span>
                                      <h4 className="text-[1.12rem] font-semibold tracking-[-0.035em] text-[#1e2a33] md:text-[1.25rem]">{group.company}</h4>
                                    </div>
                                    <p className="mt-1 text-sm text-[#66727d]">{group.role}</p>
                                  </div>
                                  <p className="text-sm font-medium text-[#8c969f]">{group.period}</p>
                                </div>

                                <div className="mt-4 space-y-3.5">
                                  {group.points.map((point, pointIndex) => (
                                    <p key={`${group.company}-${pointIndex}`} className="relative pl-5 text-[15px] leading-8 text-[#52606b] md:text-[16px] before:absolute before:left-0 before:top-[0.85rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#9aa8b2]">
                                      {point}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          section.title === "教育背景" ? (
                            <div className="grid gap-5 md:grid-cols-[1.05fr_1.2fr_1fr] md:items-center">
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9aa8b2]">Period</p>
                                <p className="mt-1 flex items-center text-[15px] font-normal tracking-[-0.01em] text-[#687783] md:text-[16px]">
                                  <span>2021.09</span>
                                  <span className="mx-2 h-px w-5 shrink-0 bg-[#c8d0d6]" aria-hidden="true" />
                                  <span>2025.06</span>
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9aa8b2]">University</p>
                                <p className="mt-1 text-[15px] font-normal leading-7 text-[#687783] md:text-[16px]">华北理工大学（全日制）</p>
                              </div>
                              <div className="md:text-right">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#9aa8b2]">Major</p>
                                <p className="mt-1 text-[15px] font-normal leading-7 text-[#687783] md:text-[16px]">产品设计（本科）</p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3.5">
                              {section.items.map((item, itemIndex) => (
                                <p key={`${section.title}-${itemIndex}`} className="relative pl-5 text-[15px] leading-8 text-[#52606b] md:text-[16px] before:absolute before:left-0 before:top-[0.85rem] before:h-1.5 before:w-1.5 before:rounded-full before:bg-[#9aa8b2]">
                                  {item}
                                </p>
                              ))}
                            </div>
                          )
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
