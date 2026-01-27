'use client';

import { useState, useRef } from 'react';

interface EmbeddingResult {
  text: string;
  embedding: number[];
  model: string;
  dimension: number;
  provider: string;
}

interface SearchResult {
  id: string;
  content: string;
  embedding: number[];
  similarity: number;
  metadata: Record<string, any>;
  createdAt: string;
}

export default function EmbeddingPracticePage() {
  const [text, setText] = useState('');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('text-embedding-ada-002');
  const [result, setResult] = useState<EmbeddingResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const providers = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'langchain', label: 'LangChain' },
    { value: 'llamaindex', label: 'LlamaIndex' },
    { value: 'vercelai', label: 'Vercel AI' },
  ];

  const models = [
    { value: 'text-embedding-ada-002', label: 'text-embedding-ada-002' },
    { value: 'text-embedding-3-small', label: 'text-embedding-3-small' },
    { value: 'text-embedding-3-large', label: 'text-embedding-3-large' },
  ];

  const handleGenerateEmbedding = async () => {
    if (!text.trim()) {
      setError('Please enter text to generate embedding');
      return;
    }

    setIsGenerating(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(`/api/${provider}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, model }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate embedding');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Error generating embedding: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter search query');
      return;
    }

    setIsSearching(true);
    setError('');
    setSearchResults([]);

    try {
      // 先为查询生成嵌入
      const embedResponse = await fetch(`/api/${provider}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: searchQuery, model }),
      });

      if (!embedResponse.ok) {
        throw new Error('Failed to generate search query embedding');
      }

      const embedData = await embedResponse.json();

      // 这里应该调用后端的搜索API，这里使用模拟数据
      // 实际项目中，应该在后端实现更高效的向量搜索
      const mockResults: SearchResult[] = [
        {
          id: '1',
          content: text,
          embedding: embedData.embedding,
          similarity: 0.95,
          metadata: { source: 'user_input' },
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          content: 'This is a sample document about machine learning',
          embedding: Array(1536).fill(0).map(() => Math.random() - 0.5),
          similarity: 0.75,
          metadata: { source: 'sample' },
          createdAt: new Date().toISOString(),
        },
        {
          id: '3',
          content: 'Another example document about artificial intelligence',
          embedding: Array(1536).fill(0).map(() => Math.random() - 0.5),
          similarity: 0.65,
          metadata: { source: 'sample' },
          createdAt: new Date().toISOString(),
        },
      ];

      setSearchResults(mockResults);
    } catch (err) {
      setError('Error searching: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setText(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-center">Embedding 实践</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：嵌入生成 */}
          <div className="border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6">生成嵌入向量</h2>

            {/* 文本输入 */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">输入文本</label>
              <textarea
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="输入要生成嵌入的文本..."
              />
              <div className="mt-2 flex justify-between items-center">
                <button
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => fileInputRef.current?.click()}
                >
                  上传文件
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".txt,.md,.json"
                  className="hidden"
                />
                <span className="text-sm text-gray-500">{text.length} 字符</span>
              </div>
            </div>

            {/* 提供商选择 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">AI 提供商</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                >
                  {providers.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">模型</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {models.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 生成按钮 */}
            <button
              className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleGenerateEmbedding}
              disabled={!text.trim() || isGenerating}
            >
              {isGenerating ? '生成中...' : '生成嵌入向量'}
            </button>

            {/* 错误信息 */}
            {error && (
              <div className="mt-4 text-red-600 text-sm">{error}</div>
            )}

            {/* 结果显示 */}
            {result && (
              <div className="mt-6 p-4 bg-gray-50 rounded-md">
                <h3 className="text-lg font-medium mb-2">生成结果</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">提供商:</span> {result.provider}</p>
                  <p><span className="font-medium">模型:</span> {result.model}</p>
                  <p><span className="font-medium">维度:</span> {result.dimension}</p>
                  <p><span className="font-medium">嵌入向量 (前 5 个值):</span> [
                    {result.embedding.slice(0, 5).join(', ')}
                    {result.embedding.length > 5 ? ', ...' : ''}
                  ]</p>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：搜索 */}
          <div className="border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-6">相似度搜索</h2>

            {/* 搜索输入 */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">搜索查询</label>
              <textarea
                className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="输入搜索查询..."
              />
            </div>

            {/* 搜索按钮 */}
            <button
              className="w-full bg-green-600 text-white py-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSearch}
              disabled={!searchQuery.trim() || isSearching}
            >
              {isSearching ? '搜索中...' : '搜索相似内容'}
            </button>

            {/* 搜索结果 */}
            {searchResults.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3">搜索结果</h3>
                <div className="space-y-4">
                  {searchResults.map((item, index) => (
                    <div key={item.id} className="border border-gray-200 rounded-md p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium">结果 {index + 1}</span>
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          相似度: {item.similarity.toFixed(3)}
                        </span>
                      </div>
                      <p className="text-sm mb-2 line-clamp-3">{item.content}</p>
                      <div className="text-xs text-gray-500">
                        创建时间: {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 说明 */}
        <div className="mt-12 p-6 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">技术说明</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>使用 OpenAI 的 <code>text-embedding-ada-002</code> 模型生成嵌入向量</li>
            <li>嵌入向量维度: 1536</li>
            <li>相似度计算使用余弦相似度</li>
            <li>支持多种 AI 服务提供商: OpenAI、LangChain、LlamaIndex、Vercel AI</li>
            <li>支持文本和文件上传</li>
          </ul>
        </div>
      </div>
    </div>
  );
}