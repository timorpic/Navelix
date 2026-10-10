/**
 * 极简组件渲染工具（基于 react-dom/client，不引入测试框架）。
 *
 * 与 `tsx-loader.ts` 配套：后者负责把 .tsx 编译成可 import 的 ESM，
 * 这里负责挂载、查询 DOM 与清理。
 *
 * 用 React 19 自带的 `act()` 冲刷渲染队列（配合 `setupDom()` 设置的
 * `IS_REACT_ACT_ENVIRONMENT`），不依赖 @testing-library。
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = any;

export interface RenderResult {
  container: HTMLElement;
  /** 卸载并清空容器 */
  unmount: () => void;
  /** 用新 props 重新渲染同一容器 */
  rerender: (props: Record<string, unknown>) => void;
}

/** 把组件挂载到一个新建的容器 div 上。 */
export function render(
  Component: AnyComponent,
  props: Record<string, unknown> = {},
): RenderResult {
  const { createRoot } = require("react-dom/client") as typeof import("react-dom/client");
  const React = require("react") as typeof import("react");
  const { act } = require("react") as { act: (fn: () => void) => void };

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  const paint = (p: Record<string, unknown>) => {
    act(() => {
      root.render(React.createElement(Component, p));
    });
  };
  paint(props);

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
    rerender: (p) => paint(p),
  };
}

/** 执行一段会触发状态更新的交互，并等待 React 提交。 */
export function withAct(fn: () => void): void {
  const { act } = require("react") as { act: (fn: () => void) => void };
  act(fn);
}

/** 按可见文本查找元素（只看元素自身的直接文本节点）。 */
export function getByText(text: string | RegExp): HTMLElement | null {
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("*"))) {
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent || "")
      .join("")
      .trim();
    if (!own) continue;
    if (typeof text === "string" ? own === text : text.test(own)) return el;
  }
  return null;
}

/** 按 CSS 选择器查询（返回全部匹配）。 */
export function queryAll(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector));
}

/** 按 CSS 选择器查询首个匹配。 */
export function query(selector: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(selector);
}

/** 触发一次 click 事件并等待 React 提交。 */
export function click(el: HTMLElement): void {
  withAct(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** 设置受控表单控件的值并派发 input + change 事件。 */
export function setValue(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  withAct(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** 清空 document.body（每个用例之间调用）。 */
export function cleanup(): void {
  document.body.innerHTML = "";
}
