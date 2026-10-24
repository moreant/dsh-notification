# dsh-notification

DeepSeek Harness Web GUI 的桌面通知插件。当会话结束一轮任务时，浏览器通过系统 `Notification` API 弹出通知，让你切到别的标签页也能知道 DSH 已经完成。按结束状态开关 + 关键词包含/排除规则，精确控制哪些完成要提醒。

**无需改动 harness**：host 侧贡献一个会话投影（每个会话最近完成一轮的有界摘要），client 侧监听会话列表的完成提醒，并应用自己持久化的偏好设置。

```
host:   notification 投影（最近一轮的原因/正文/工具名） --session/projection--> 浏览器
client: 会话列表完成提醒（实时、去重）+ 持久化设置
        -> 权限 + 当前会话可见性门控
        -> new Notification("DSH 已完成", { body: "部署完成" })
```

## 安装

```sh
dsh plugin --profile web add https://github.com/moreant/dsh-notification/archive/refs/tags/v0.1.6.tar.gz
```

随后重启 web 服务以加载 host 半部分与新的 client bundle。默认的 `dsh web` profile 已包含所需 client 组合（会话列表、设置外壳、locale）。

`0.1.6` 修复登录或屏幕唤醒后通知中心把旧通知成批重放的问题：完成通知共用同一个 tag（只保留最新一条），投递记账后在页面隐藏、锁屏、休眠、注销、关机与下次加载时按记录撤回。

`0.1.5` 同时兼容 Harness 0.1.x 与 0.2.x 的客户端结构和投影契约：等待用户处理的交互在 0.2.x 上取自 `uiSession.sessionStatus`（回退到 0.1.2 的 `pendingInteractions` 可观察对象与 0.1.1 的列表行字段），「仅在不在视野内时提醒」的门控在 0.1.x 用列表快照的 `current`，在 0.2.x 用行上的 `retainedBy.mainView` 保留计数。

只有在 npm 上拥有该包名时才可按名称安装：npm 上的 `dsh-notification` 属于另一个不相关的项目，按名称安装会装到它，而不是本插件——请使用上面的 tarball 地址。

设置段位于 **设置 > 通知**。

## 设置

| 设置项 | 默认 | 作用 |
| --- | --- | --- |
| 启用通知 | 开 | 总开关；关闭后不再弹出，规则与偏好保留。 |
| 正常完成 / 出错 / 中止 / 阻塞 / 达 Token 上限 | 完成 + 出错开，其余关 | 哪些结束状态触发通知（host 投影会报告结束原因）。 |
| 关键词规则 | 无 | 针对会话标题、该轮回复文本与调用过的工具名做包含/排除匹配。包含规则：至少命中一条才通知；排除规则：命中即不通知。支持字面量或正则，可区分大小写。 |
| 需要手动关闭 | 关 | 通知保持显示直到手动关闭。 |
| 仅在任务不在眼前时通知 | 开 | 只有完成任务所属会话正显示在眼前时才不提醒；页面在后台，或正在查看其他会话、其他工作区时仍会提醒。关闭后，即使正在观看该会话也会通知。同一会话的通知会互相替换。 |
| 锁屏 / 睡眠前清空通知 | 开 | 在页面隐藏、锁屏、屏幕休眠、注销或关机前撤回已投递的通知，避免 macOS 在唤醒或下次登录后几秒内把旧通知成批重放。屏幕仅在休眠时保留最后一条完成通知，方便唤醒后查看；手工锁屏则全部撤回（DSH 会重新提醒仍在等待的交互）。 |

偏好保存在浏览器（localStorage）。设置段内还可授予浏览器权限并发送测试通知。

全部完成通知共用一个通知 tag，因此通知中心里只保留最新一条，不会堆成时间线；每次投递都会记入本地账本（`dsh-notification.delivered`），在上述时机或下次加载页面时按记录撤回。

## 配置

Host 侧可调参数在 `cordis.yml` 的插件行上：

```yaml
- id: dsh-notification
  name: dsh-notification
  config:
    maxBodyChars: 400      # 投影正文预算；更长的回复会在 host 侧省略号截断
```

## 对模型的影响

| 方面 | 效果 |
| --- | --- |
| Token 开销 | 无 —— 通知纯属 UI，绝不进入请求。 |
| 工具调用 | 无 —— 模型没有新增任何工具。 |
| 会话日志 | 不变 —— 投影只读已有日志，不新增事件。 |
| 提示词 | 不变 —— 不注册任何 system prompt 段。 |

## 权限边界

- host 侧对会话日志做纯投影折叠（轮次原因、有界的回复文本、工具名），由投影通道交付给浏览器；插件不写日志，不注册面向模型的工具。
- client 侧监听会话列表的完成提醒（运行时已计算的"未选中会话已完成"实时去重信号），仅在用户授予 Notification 权限后弹通知。
- 规则匹配在 client 侧针对投影内容进行；回复正文不超过 `maxBodyChars`。

## 开发

```sh
pnpm install            # 链接同级 dsh 仓库用于构建与测试
pnpm run check          # typecheck + tests + build
pnpm run test           # vitest（host 投影 + 组合、client 判定/runner/辅助函数/设置段）
pnpm run build          # esbuild host/client/invariant 打包 + tsc 声明
```

仓库依赖同级 `../dsh` 仓库用于开发期 `link:` 解析。组合测试用真实 `SessionStore` 与 `SessionProjectionRegistry` 验证投影折叠。

## 已知限制

- 通知需要页面处于打开状态（隐藏时可弹，但关闭标签页后不再弹），且需授予 Notification 权限；站点权限被拒后无法从页面内恢复。
- 通知在每轮结束（任意会话的 running→idle 边沿）触发一次；断线期间完成的轮次在重连后不会补发。
- 规则匹配对象为会话标题 + 最近一轮的回复文本与工具名，不匹配更早的轮次。
- 通知正文是纯文本摘要；点击仅聚焦窗口（不深链到具体轮次）。
- 撤回依赖浏览器能从通知 tag 重新拿到句柄：`new Notification(…, { tag })` 在 Chrome 系内核上会复用同一 tag 的投递项，`close()` 即可撤回；若某个内核不支持，旧通知可能仍留在通知中心，此时可在系统通知设置里调短该应用的保留时间。

## License

MIT
