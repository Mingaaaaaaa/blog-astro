---
title: 'React-scan 是如何实现的'
description: ' 可视化元素渲染次数，出圈好用的React-scan是如何实现的？'
pubDate: '12 09 2024'
---

## 项目概览

[GitHub - aidenybai/react-scan: Scan for React performance issues and eliminate slow renders in your app](https://github.com/aidenybai/react-scan)

million 团队通过可视化框选 React 项目中渲染的元素，高亮渲染次数，让用户发现项目性能问题

## 技巧解析

### 项目架构

-  CLI：直接测试本地/线上项目，使用 playwright，注入 script 标签，统计渲染次数，生产报告
-  core
    - instrumentation： 连接 fiber，一系列处理 fiber 的方法，提供每次渲染生命周期接口，运行各种回调函数
    - web： canvas 展示高亮层
    - monitor ：监控性能组件，包含兼容了各种框架的路由监听，计算行为耗时等等，有个中台展示
- react-component-name

总得来的说逻辑主要是下面的代码

```typescript
export const start = () => {
 
 //初始化 canvas 层
  initReactScanOverlay();
  const overlayElement = document.createElement('react-scan-overlay') as any;
  document.documentElement.appendChild(overlayElement);
  const ctx = overlayElement.getContext();
  
  // 审查状态机
  createInspectElementStateMachine();
  // 音效 context
  const audioContext =
    typeof window !== 'undefined'
      ? new (window.AudioContext ||
        // @ts-expect-error -- This is a fallback for Safari
        window.webkitAudioContext)()
      : null;

  logIntro();
 
  // 注册 instrument
  // TODO: dynamic enable, and inspect-off check
  const instrumentation = createInstrumentation({
    kind: 'devtool',
    onCommitStart() {
      ReactScanInternals.options.value.onCommitStart?.();
    },
    isValidFiber(fiber) {
      return isValidFiber(fiber);
    },
    // 每次渲染时的回调
    onRender(fiber, renders) {
      //记录渲染性能
      updateFiberRenderData(fiber, renders);
      // 处理所有 renders
      for (let i = 0, len = renders.length; i < len; i++) {
        const render = renders[i];
        const outline = getOutline(fiber, render);
   
        // 高亮框
        ReactScanInternals.scheduledOutlines.push(outline);
        // audio
        playGeigerClickSound(audioContext, amplitude);
      }
      flushOutlines(ctx, new Map());
    },
    onCommitFinish() {
      ReactScanInternals.options.value.onCommitFinish?.();
    },
  });
};
```

### React Fiber 数据获取

```typescript
const { renderers } = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (!renderers) return null;
    for (const [_, renderer] of Array.from(renderers)) {
      try {
        const fiber = renderer.findFiberByHostInstance(element);
        if (fiber) return fiber;
      } catch (e) {
        // If React is mid-render, references to previous nodes may disappear
      }
    }
```

通过 bippy 提前注入 **REACT_DEVTOOLS_GLOBAL_HOOK** 全局变量 伪装成 React-devtool 和 React 通信，获取 fiber，从底层计算渲染次数

具体的代码在 [GitHub - aidenybai/bippy: a hacky way to get fibers from react](https://github.com/aidenybai/bippy)

```typescript
// DevTool 暴露的接口，bippy 进行二次封装简化
interface __REACT_DEVTOOLS_GLOBAL_HOOK__ {
  // list of renderers (react-dom, react-native, etc.)
  renderers: Map<RendererID, reactRenderer>;

  // called when react has rendered everything for an update and the fiber tree is fully built and ready to
  // apply changes to the host tree (e.g. DOM mutations)
  onCommitFiberRoot: (
    rendererID: RendererID,
    root: FiberRoot,
    commitPriority?: number
  ) => void;

  // called when effects run
  onPostCommitFiberRoot: (rendererID: RendererID, root: FiberRoot) => void;

  // called when a specific fiber unmounts
  onCommitFiberUnmount: (rendererID: RendererID, fiber: Fiber) => void;
}

// 统计渲染回调
globalHook.ReactScanInternals.onRender = (fiber, renders) => {
        let localCount = 0;
        for (const render of renders) {
          localCount += render.count;
        }
        count = localCount;
      };
```

#### 获取 React组件名字

react-component-name插件，给 fiber 注入组件名字，具体获取名字的方法还是在 bippy,  fiber.type.name

项目使用 unplugin 作为统一插件系统，兼容不同打包工具。

### 用 canvas 绘制

```typescript
export const drawStatsPill = (
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  stats: PerformanceStats,
  kind: 'locked' | 'inspecting',
  fiber: Fiber | null,
) => {
 // 获取 fiber 信息
  const componentName = getDisplayName(fiber?.type) ?? 'Unknown';
  let text = componentName;
  if (stats.count) {
    text += ` • ×${stats.count}`;
    if (stats.time) {
      text += ` (${stats.time.toFixed(1)}ms)`;
    }
  }

  ctx.save();
 
  // 一些样式和状态展示
  ctx.fillStyle = 'rgb(37, 37, 38, .75)';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 3);
  ctx.fill();

  if (kind === 'locked') {
    const lockX = pillX + pillPadding;
    const lockY = pillY + (pillHeight - lockIconSize) / 2 + 2;
    drawLockIcon(ctx, lockX, lockY, lockIconSize);
    currentLockIconRect = {
      x: lockX,
      y: lockY,
      width: lockIconSize,
      height: lockIconSize,
    };
  } else {
    currentLockIconRect = null;
  }

  ctx.fillStyle = 'white';
  ctx.textBaseline = 'middle';
  const textX =
    pillX +
    pillPadding +
    (kind === 'locked' ? lockIconSize + lockIconPadding : 0);
  ctx.fillText(text, textX, pillY + pillHeight / 2);
  ctx.restore();
};
```

### 用 performanceObserver 记录渲染和交互时间

```typescript
const setupPerformanceListener = (onEntry) => {
  // 使用 PerformanceObserver 监听交互事件
  const po = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => 
      processInteractionEntry(entry)
    );
  });

  // 监听两种类型的性能事件
  po.observe({
    type: 'event',
    buffered: true,
    durationThreshold: 16, // 只收集超过 16ms 的交互
  });
  
  po.observe({
    type: 'first-input', // 首次输入延迟
    buffered: true,
  });
}
```

### web audio 做音效

借鉴了 [react-geiger](https://github.com/kristiandupont/react-geiger)

对应的 web api:  AudioContext
`BaseAudioContext.createOscillator()`

```typescript
export const playGeigerClickSound = (
  audioContext: AudioContext, // 音频上下文
  amplitude: number, // 振幅
) => {
  // 计算音量，确保最小为0.5
  const volume = Math.max(0.5, amplitude);
  // 持续时间
  const duration = 0.001;
  // 计算起始频率
  const startFrequency = 440 + amplitude * 200;

  // 创建振荡器
  const oscillator = audioContext.createOscillator();
  oscillator.type = 'sine'; // 设置振荡器类型为正弦波
  oscillator.frequency.setValueAtTime(startFrequency, audioContext.currentTime); // 设置起始频率
  oscillator.frequency.exponentialRampToValueAtTime(
    220, // 目标频率
    audioContext.currentTime + duration, // 到达目标频率的时间
  );

  // 创建增益节点
  const gainNode = audioContext.createGain();
  gainNode.gain.setValueAtTime(volume, audioContext.currentTime); // 设置音量
  gainNode.gain.exponentialRampToValueAtTime(0.01, duration / 2); // 设置音量衰减

  // 连接振荡器和增益节点
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // 开始播放
  oscillator.start();
  // 停止播放
  oscillator.stop(audioContext.currentTime + duration);
};
```

## 学习总结

+ 伪装 devtool 劫持 fiber 数据
+ 了解web audio api
+ 了解unplugin 插件系统 ，获取组件名字的方式

