import Image from 'next/image'

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-gray-200 py-6">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Tools</h1>
          <nav>
            <ul className="flex space-x-6">
              <li><a href="#" className="hover:text-blue-600">首页</a></li>
              <li><a href="#" className="hover:text-blue-600">功能</a></li>
              <li><a href="#" className="hover:text-blue-600">关于</a></li>
            </ul>
          </nav>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-12">
        <section className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">欢迎使用 AI Tools</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            基于 Next.js 14 + TypeScript + Tailwind CSS 构建的 AI 工具应用
          </p>
        </section>
        
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3">工具 1</h3>
            <p className="text-gray-600">这是第一个 AI 工具的描述</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3">工具 2</h3>
            <p className="text-gray-600">这是第二个 AI 工具的描述</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold mb-3">工具 3</h3>
            <p className="text-gray-600">这是第三个 AI 工具的描述</p>
          </div>
        </section>
      </main>
      
      <footer className="border-t border-gray-200 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} AI Tools. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}