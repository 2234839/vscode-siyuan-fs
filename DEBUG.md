# 调试思源笔记VSCode扩展

## 调试步骤

### 1. 准备思源笔记环境

确保您的思源笔记正在运行，并且：
- 开启了API访问权限
- 获取了API token（设置 → 关于 → API token）
- 知道思源笔记的访问地址（通常是 http://localhost:6806）

### 2. 配置VSCode设置

按 `Ctrl+,` 打开设置，添加思源笔记实例配置：

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

### 3. 启动调试

#### 方法一：使用F5启动调试
1. 在VSCode中按 `F5` 键
2. 会自动编译并启动新的VSCode窗口（Extension Development Host）
3. 在新窗口中测试扩展功能

#### 方法二：使用调试面板
1. 按 `Ctrl+Shift+D` 打开调试面板
2. 选择 "Run Extension" 配置
3. 点击绿色播放按钮启动

### 4. 测试扩展功能

#### 测试连接
1. 在新窗口中按 `Ctrl+Shift+P`
2. 输入 "Siyuan: Add Instance" 添加实例
3. 或者直接在设置中配置实例

#### 测试文件系统
1. 按 `Ctrl+Shift+E` 打开文件浏览器
2. 在地址栏输入 `siyuan://local/` （替换为您的实例ID）
3. 浏览思源笔记的笔记本和文档

#### 测试文档编辑
1. 在虚拟文件系统中找到要编辑的文档
2. 双击打开文档
3. 编辑内容并保存（应该自动同步到思源笔记）

### 5. 调试技巧

#### 查看控制台输出
- 按 `Ctrl+Shift+U` 打开输出面板
- 选择 "Extension Host" 查看扩展日志
- 查看 `[SiyuanClient]` 相关的请求日志

#### 设置断点
1. 在源代码中点击行号左侧设置断点
2. 启动调试后，断点会自动生效
3. 可以查看变量值和调用栈

#### 网络请求调试
扩展会输出所有思源API请求的日志：
```
[SiyuanClient] Request: POST http://localhost:6806/api/notebook/lsNotebooks
```

### 6. 常见问题排查

#### 连接失败
- 检查思源笔记是否正在运行
- 验证API token是否正确
- 确认URL地址是否正确
- 检查网络连接

#### 权限错误
- 确保思源笔记已启用API访问
- 验证token是否有足够权限

#### 编译错误
- 运行 `pnpm compile` 重新编译
- 检查TypeScript类型错误

### 7. 开发模式

启动监听模式自动编译：
```bash
pnpm watch
```

然后按F5启动调试，修改代码后会自动重新编译。

### 8. 打包扩展

开发完成后，可以打包为.vsix文件：
```bash
npm install -g @vscode/vsce
vsce package
```

然后可以分享.vsix文件给其他用户安装。