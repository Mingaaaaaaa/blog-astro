---
title: 'MidScene 是如何实现的'
description: 'AI 赋能，自然语言完成 UI 自动测试化的工具，MidScene是如何实现的？'
pubDate: '1 04 2024'
---
## 项目概览
字节 WebInfra 团队出于简化 UI 测试脚本目的，在 UI 自动化测试方面做了一套 SDK。

可以通过 浏览器插件，yaml ，外接 pupperteer 等使用

## 技巧解析
基于大模型解析页面能力，分析用户意图，做出 action plan，最后落地于各个场景

input -> see ->  plan -> action -> see -> plan -> action -> ..... -> done

### 项目架构
+ core ： 包含对接大模型能力，截取图片，对话保存，计划 action 等等
+ cli ：命令行，主要用于流水线 和 解析 yaml
+ web-integration ：实现了 appium，chrome-extension 和 pupperteer 等等的接入，还有插件页面，录屏等等 devtool 页面，实现自然语言操控页面

### 不同接入方式(agent)如何操纵页面
+ yaml ： 翻译 yaml，做计划、 调用 pupperteer 运行命令
+ extension ：通过插件接口，chrome.debugger 通信，
+ appium ：通过 webdriverio 的 remote 方法初始化 浏览器实例， 为移动端测试提供 click tab 等等
+ 三方测试工具接入（playright, pupperteer）：内置 api

## 学习总结

### [webdriver](https://w3c.github.io/webdriver/#abstract): 驱动浏览器的标准
WebDriver 是一种远程控制接口，可用于检查和控制用户代理（如浏览器）。基于 http
它提供了一种平台和语言无关的通信协议，允许进程外的程序远程指示网页浏览器的行为。
它提供了一组接口，用于发现和操作网页文档中的 DOM 元素，以及控制用户代理的行为。
主要目的是让网页开发者编写测试，自动化地从一个独立的控制进程中操控用户代理（如浏览器），但它也可以用来让浏览器内部的脚本控制同一个/不同浏览器。

>  <font style="color:rgb(111, 117, 122);">Selenium WebDriver 是根据 </font>[W3C Recommendation](https://www.w3.org/TR/webdriver1/) 提供标准，本地/远端 控制浏览器， 助力web自动化测试
>

### Appium：基于 webdrive 协议的自动化框架
Appium 是一个跨平台、可扩展的自动化工具，帮助开发者用熟悉的语言和工具实现多平台应用的 UI 自动化测试。

工作流程：启动服务器（http），客户端使用多种语言调用 api， api 使用驱动生成对应平台的命令，做出行动

更多的想一个中间人 ，对客户端 兼容各种语言调用  基于 webdrive 的 api， 对需要测试的设备 编写各种驱动，以便完成测试行为

### WebdriverIO：下一代自动测试框架
更先进的 web 测试框架，移动端能力也是是基于 appium

### node 的 tty 标志是什么

<font style="color:rgb(255, 80, 44);background-color:rgb(255, 245, 245);">TTY </font><font >  的意思是 “电传打印机（teletypewriter）”，在这种情况下专门用于终端，下面的代码表示 tty不同 情况下 输出的差异</font>

```javascript
if (isTTY) {
    const summaryContents = () => {
      const summary: string[] = [''];
      for (const context of fileContextList) {
        summary.push(
          contextTaskListSummary(context.player.taskStatusList, context),
        );
      }
      summary.push('');
      return summary;
    };
    ttyRenderer = new TTYWindowRenderer({
      outputStream: process.stdout,
      errorStream: process.stderr,
      getWindow: summaryContents,
      interval: spinnerInterval,
    });

    ttyRenderer.start();
    for (const context of fileContextList) {
      await context.player.run();
    }
    ttyRenderer.stop();
  } else {
    for (const context of fileContextList) {
      const { mergedText } = contextInfo(context);
      console.log(mergedText);
      await context.player.run();
      console.log(
        contextTaskListSummary(context.player.taskStatusList, context),
      );
    }
  }
```

