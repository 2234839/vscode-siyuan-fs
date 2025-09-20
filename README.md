# Siyuan File System for VSCode

一个将思源笔记实例映射为 VSCode 虚拟文件系统的扩展，让你可以直接在 VSCode 中编辑和管理思源笔记。

## 功能特性

- 🌐 **多实例支持** - 同时连接和管理多个思源笔记实例
- 📁 **虚拟文件系统** - 将思源笔记映射为虚拟文件系统，支持文件浏览和编辑
- ⚡ **实时同步** - 编辑文件后自动同步到思源笔记
- 🔍 **智能缓存** - 减少网络请求，提升性能
- 📝 **Kramdown 支持** - 完整支持思源笔记的 Kramdown 格式
- 🔐 **安全认证** - 使用思源笔记的 API Token 进行认证

## 安装

### 开发环境安装

```bash
# 克隆项目
git clone <repository-url>
cd vscode-siyuan-fs

# 安装依赖
pnpm install

# 编译项目
npm run compile

# 或监听模式
npm run watch
```

### 扩展安装

1. 在 VSCode 中按 `F5` 启动调试
2. 或者使用 `vsce package` 打包为 .vsix 文件后安装

## 配置

### 1. 配置思源笔记

首先需要在思源笔记中启用 API 访问：

1. 打开思源笔记
2. 进入 **设置** → **关于**
3. 复制 **API token**

### 2. 配置 VSCode

在 VSCode 设置中添加思源笔记实例：

```json
{
  "siyuan.instances": [
    {
      "id": "work",
      "name": "工作笔记",
      "url": "http://localhost:6806",
      "token": "your-api-token-here",
      "enabled": true
    },
    {
      "id": "personal",
      "name": "个人笔记",
      "url": "http://localhost:6807",
      "token": "your-api-token-here",
      "enabled": true
    }
  ]
}
```

**配置说明：**
- `id`: 实例唯一标识符
- `name`: 显示名称
- `url`: 思源笔记 API 地址
- `token`: API 认证令牌
- `enabled`: 是否启用该实例

## 使用方法

### 1. 添加实例

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 "Siyuan: Add Instance"
3. 按提示填写实例信息

### 2. 浏览文件

1. 按 `Ctrl+Shift+E` 打开文件浏览器
2. 在地址栏输入 `siyuan://instance-id` (例如 `siyuan://work`)
3. 浏览思源笔记的笔记本和文档

### 3. 编辑文档

1. 在虚拟文件系统中找到要编辑的文档
2. 双击打开文档
3. 编辑内容
4. 保存文件（自动同步到思源笔记）

### 4. 文件系统结构

```
siyuan://instance-name/
├── notebooks/           # 笔记本目录
│   ├── notebook-id/    # 笔记本
│   │   └── documents/  # 文档
│   └── ...
└── documents/          # 所有文档
    ├── doc-id.md       # 文档 (kramdown 格式)
    └── ...
```

## 命令

- `Siyuan: Add Instance` - 添加思源笔记实例
- `Siyuan: Refresh File System` - 刷新文件系统缓存

## 技术栈

- **TypeScript** - 类型安全的 JavaScript
- **ArkType** - 运行时类型验证
- **VSCode API** - VSCode 扩展开发
- **Axios** - HTTP 客户端
- **ESBuild** - 快速的构建工具

## 开发

### 项目结构

```
src/
├── api/               # API 客户端和类型定义
│   ├── siyuan-client.ts    # 思源 API 客户端
│   └── types.ts            # 类型定义
├── provider/          # 文件系统提供者
│   ├── siyuan-fs.ts        # 主文件系统实现
│   └── file-cache.ts       # 文件缓存管理
├── config/            # 配置管理
│   └── settings.ts         # 配置管理器
├── utils/             # 工具函数
│   ├── path-utils.ts       # 路径处理工具
│   └── error-handler.ts    # 错误处理
└── extension.ts      # 扩展入口
```

### 开发流程

1. 修改代码
2. 运行 `npm run compile` 编译
3. 按 `F5` 启动调试
4. 在新窗口中测试扩展功能

### 调试技巧

- 使用 `console.log` 输出调试信息
- 查看 VSCode 开发者控制台 (Ctrl+Shift+U)
- 使用 VSCode 调试器设置断点

## 贡献

欢迎提交 Issue 和 Pull Request！

### 开发规范

- 遵循 TypeScript 严格模式
- 使用 ArkType 进行运行时类型验证
- 保持代码简洁可读
- 添加必要的错误处理

## 许可证

MIT License

## 更新日志

### v0.0.1

- 初始版本发布
- 支持多实例配置
- 实现虚拟文件系统
- 支持文档读写操作
- 实现缓存机制

## 常见问题

### Q: 如何获取思源笔记的 API token？

A: 在思源笔记中进入 **设置** → **关于**，找到 "API token" 字段。

### Q: 支持哪些操作？

A: 目前支持：
- 读取文档内容（Kramdown 格式）
- 编辑文档并同步到思源
- 浏览笔记本和文档列表
- 删除文档

### Q: 不支持哪些操作？

A: 暂不支持：
- 创建新文档
- 重命名文档或移动文档
- 创建目录
- 文件上传

### Q: 遇到网络错误怎么办？

A: 扩展会自动重试，也可以使用 "Siyuan: Refresh File System" 命令手动刷新。

### Q: 如何提高性能？

A: 扩展内置了缓存机制，频繁访问的文档会缓存在本地。可以使用刷新命令清除缓存。