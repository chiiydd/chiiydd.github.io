{{- /* Sample example post */ -}}
---
title: "React Fiber 的协调算法：从递归到可中断"
date: 2026-04-22
draft: false
categories: ["learning"]
tags: ["React", "源码"]
excerpt: "为什么 16 之后 React 抛弃了递归？Fiber 把 reconciliation 拆成了一个个可中断的工作单元。"
pinned: true
hasCode: true
---

React 15 时代，reconciliation 本质上是一个深度优先的递归过程。父节点 diff 完调用 children 的 diff，沿调用栈一直走到底，中间不能停。

这意味着只要组件树足够深，主线程就会被卡住——动画掉帧、输入延迟、scroll 抖动，都是这种「不可中断的工作」造成的。

## 把递归换成链表

Fiber 的第一性原理只有一句：把调用栈搬到堆上。每个 Fiber 节点既是组件实例，也是工作单元，节点之间用 `child` / `sibling` / `return` 三个指针连成一棵可遍历的树。

```ts
type Fiber = {
  type: Function | string;
  stateNode: any;
  child: Fiber | null;     // 第一个子节点
  sibling: Fiber | null;   // 下一个兄弟
  return: Fiber | null;    // 父节点
  alternate: Fiber | null; // current ↔ workInProgress
  flags: number;           // 副作用标记
};
```

遍历不再依赖 JS 调用栈，而是一个手写的循环。每处理完一个节点，就检查 deadline——剩余时间不够就 yield 回浏览器，等下一帧再继续。

```ts
function workLoop(deadline) {
  while (nextUnitOfWork && deadline.timeRemaining() > 1) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
  }
  if (nextUnitOfWork) {
    requestIdleCallback(workLoop);
  } else {
    commitRoot();
  }
}
```

## render 与 commit 的两阶段

可中断只发生在 render 阶段——计算出 workInProgress 树和副作用列表。commit 阶段是同步的、不可打断的，因为这一阶段要真正操作 DOM，必须保证一致性。

理解了这个分界，你就明白为什么 `useEffect` 的回调是异步的，而 `useLayoutEffect` 是同步的：它们分别挂在两个不同的阶段。

## 代价是什么

Fiber 不是没有代价。每个节点多了大约 80–120 字节的开销，alternate 指针让内存占用接近翻倍。但换来了 60fps 的可调度性，以及 Suspense、Concurrent Mode 这类高级特性的基础设施。

下一篇会写 Lane 模型——Fiber 之上的优先级调度系统，也是 `useTransition` 真正的底层。
