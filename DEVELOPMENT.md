# VSCode扩展开发调试指南

## 方法一：从源码直接加载（推荐）

### 1. 编译扩展
```bash
pnpm compile
```

### 2. 打开扩展面板
- 按 `Ctrl+Shift+X` 打开扩展面板
- 点击右上角的 `...` 菜单
- 选择 "从 VSIX 安装" 或 "Install from VSIX..."

### 3. 加载扩展
选择 `加载未打包的扩展`（Load Unpacked Extension）

### 4. 选择扩展目录
导航到项目根目录 `/home/gs/opensource_code/vscode-siyuan-fs` 并选择

## 方法二：使用 F5 调试模式

### 1. 确保调试配置存在
项目已包含 `.vscode/launch.json` 配置文件

### 2. 按 F5 启动调试
- 会自动编译扩展
- 启动新的 VSCode 窗口（Extension Development Host）
- 在新窗口中测试扩展功能

### 3. 调试功能
- 可以在源代码中设置断点
- 查看控制台输出（Ctrl+Shift+U）
- 调试器会自动连接

## 方法三：命令行开发

### 1. 启动监听模式
```bash
pnpm watch
```

### 2. 在另一个终端启动VSCode
```bash
code --extensionDevelopmentPath=/home/gs/opensource_code/vscode-siyuan-fs
```

## 配置思源笔记连接

### 1. 打开设置
- 按 `Ctrl+,`
- 搜索 "siyuan"

### 2. 添加实例配置
```json
{
  "siyuan.instances": [
    {
      "id": "local",
      "name": "本地思源笔记",
      "url": "http://localhost:6806",
      "token": "your-api-token-here",
      "enabled": true
    }
  ]
}
```

## 测试扩展功能

### 测试文件系统
1. 按 `Ctrl+Shift+E` 打开文件浏览器
2. 在地址栏输入 `siyuan://local/`
3. 浏览思源笔记本和文档

### 测试文档编辑
1. 找到要编辑的文档（.md文件）
2. 双击打开
3. 编辑并保存（自动同步到思源）

## 开发工作流

### 修改代码 → 自动重载
1. 运行 `pnpm watch`
2. 按 F5 启动调试
3. 修改代码后自动重新编译
4. 在调试窗口中测试新功能

### 查看日志
- 按 `Ctrl+Shift+U` 打开输出面板
- 选择 "Extension Host" 或 "Siyuan FS"
- 查看 API 请求和错误信息

## 常用调试命令

```bash
# 编译
pnpm compile

# 类型检查
pnpm tsc

# 监听模式
pnpm watch

# 启动VSCode调试
code --extensionDevelopmentPath=.
```

## 扩展重载

开发过程中，如果需要重载扩展：
1. 按 `Ctrl+Shift+P`
2. 输入 "Developer: Reload Window"
3. 或者按 `Ctrl+R` 重启窗口

## 热重载提示

为了更好的开发体验，建议：
1. 使用 `pnpm watch` 启动监听模式
2. 按 F5 启动调试会话
3. 修改代码后等待编译完成
4. 在调试窗口中测试新功能
5. 查看控制台输出调试信息