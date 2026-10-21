# Firefly 图床接入配置

Firefly 管理后台通过服务端代理连接个人 Sanyue / CloudFlare ImgBed 图床。图床 Token 仅保存在 Cloudflare Worker Secret 中，不能写入前端、公开仓库或文章内容。

## Cloudflare Worker 配置

Worker 默认使用 `https://tu.0701000.xyz`，因此通常只需要新增一个 Secret：

- 名称：`IMG_BED_API_TOKEN`
- 值：在图床管理页面新建的 API Token
- 必需权限：`upload`、`list`、`delete`

可选配置普通变量 `IMG_BED_BASE_URL`，值为图床 HTTPS 根地址（例如 `https://tu.0701000.xyz`）。未设置时会使用上面的默认地址。

## 创建 API Token

1. 打开图床登录页并使用自己的管理员账户登录。
2. 在管理界面的安全设置 / API Token 管理区域新建 Token。
3. 为 Token 选择上传、列表读取、删除三项权限。名称可填写 `Firefly Admin`。若支持过期时间，建议设置合理的到期时间。
4. 创建后立即复制 Token。图床通常不会再次展示完整值。
5. 打开 Cloudflare Dashboard → Workers & Pages → `firefly` → Settings → Variables and Secrets。
6. 添加类型为 **Secret** 的变量，名称填写 `IMG_BED_API_TOKEN`，把 Token 粘贴为值并保存。不要将 Token 填到普通变量、GitHub 文件或聊天中。

## 后台功能

部署并配置 Secret 后，登录 Firefly 后台并打开“图片库”：

- 支持 PNG、JPEG、WebP、GIF，单张最大 4 MiB。
- 可搜索图片、分页浏览、预览和复制 HTTPS 图片链接。
- 删除前会二次确认；删除图床文件会影响所有引用此图片的文章，且无法自动恢复。
- 文章可视化编辑器的插图按钮会把新图片上传到图床，文章正文仍需单独保存。

## 验收顺序

1. 在 Cloudflare 中确认 Secret 保存成功并部署最新 Worker。
2. 登录 Firefly 后台打开图片库，确认已有图片可加载。
3. 上传一张非重要测试图片，确认预览与复制链接都正常。
4. 在文章编辑器上传一张测试图，保存文章并打开前台确认图片可见。
5. 最后再测试删除测试图片，避免误删文章正在使用的图片。

如果提示缺少权限，回到图床重新生成包含所需权限的 Token，并替换 Worker Secret。切勿在公开位置粘贴或分享 Token。
