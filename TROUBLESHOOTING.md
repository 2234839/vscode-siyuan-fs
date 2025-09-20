# 思源笔记扩展故障排除

## 看不到 "Siyuan Notes" 视图

### 1. 确保扩展正确加载
1. 按 `Ctrl+Shift+X` 打开扩展面板
2. 找到 "Siyuan Note File System" 扩展
3. 确保扩展已启用（没有禁用图标）

### 2. 重新加载VSCode
1. 按 `Ctrl+Shift+P`
2. 输入 "Developer: Reload Window"
3. 或者按 `Ctrl+R` 重启VSCode

### 3. 检查Explorer面板
1. 按 `Ctrl+Shift+E` 打开文件浏览器
2. 在侧边栏中查找 "Siyuan Notes" 视图
3. 应该有一个 📚 图标的 "Siyuan Notes" 选项

### 4. 如果仍然看不到，尝试手动添加实例
1. 按 `Ctrl+Shift+P`
2. 输入 "Siyuan: Add Instance"
3. 添加思源笔记实例后，视图应该会出现

## 扩展不工作

### 1. 查看扩展日志
1. 按 `Ctrl+Shift+U` 打开输出面板
2. 选择 "Extension Host"
3. 查看是否有错误信息

### 2. 重新安装扩展
1. 在扩展面板中禁用扩展
2. 重新启用扩展
3. 或者重新加载未打包的扩展

### 3. 检查控制台
1. 按 `Ctrl+Shift+P`
2. 输入 "Developer: Open Webview Developer Tools"
3. 在Console标签查看错误

## 配置思源笔记实例

### 1. 获取API Token
1. 打开思源笔记
2. 进入 **设置** → **关于**
3. 复制 **API token**

### 2. 添加实例配置
按 `Ctrl+,` 打开设置，添加：
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

### 3. 验证思源笔记运行
确保思源笔记正在运行，并且：
- API端口正确（通常是6806）
- 网络连接正常
- API token有效

## 常见问题

### Q: 视图显示为空白
A: 这是正常的，首次使用时需要添加实例。点击 + 按钮或右键添加实例。

### Q: 添加实例后看不到内容
A: 确保思源笔记正在运行，并且连接信息正确。可以点击 "测试连接" 验证。

### Q: 加载到文件树失败
A: 检查思源笔记API是否正常工作，确保token有足够权限。

### Q: 扩展无法激活
A: 检查VSCode版本是否支持（需要1.80+），查看输出面板的错误信息。

## 调试步骤

### 1. 启用开发者模式
在VSCode设置中搜索 "developer"，启用开发者模式。

### 2. 查看详细日志
在输出面板选择 "Extension Host"，查看扩展的详细日志。

### 3. 测试命令
按 `Ctrl+Shift+P`，尝试运行以下命令：
- `Siyuan: Add Instance`
- `Siyuan: Refresh File System`

### 4. 检查文件系统
确保没有其他扩展冲突了 `siyuan` 协议。

## 联系支持

如果问题仍然存在，请：
1. 记录错误信息
2. 检查思源笔记日志
3. 提供VSCode版本和扩展版本信息