import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ★ 將 'dragon-boat-festival' 換成你的 GitHub repo 名稱
export default defineConfig({
  plugins: [react()],
  base: '/EOD_dragon-boat-festival-v2/',
})
