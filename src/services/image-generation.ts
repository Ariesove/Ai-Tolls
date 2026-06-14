"use client";

import { Attachment } from "@/types/chat";
import { v4 as uuidv4 } from "uuid";

/**
 * 判断是否需要生成图片
 */
export const shouldGenerateImage = (query: string): boolean => {
  const keywords = [
    "画图", "画一张", "生成图片", "生成一张", "draw", "generate image",
    "create image", "画个", "画一幅", "make a picture", "画一个",
    "帮我画", "请画", "帮我生成", "请生成", "帮我做", "请做", "给我生成", "给我画"
  ];
  const lowerQuery = query.toLowerCase();
  return keywords.some(keyword => lowerQuery.includes(keyword.toLowerCase()));
};

/**
 * 从用户查询中提取图片描述
 */
export const extractImagePrompt = (query: string): string => {
  const prefixes = [
    "画图", "画一张", "生成图片", "生成一张", "draw", "generate image",
    "create image", "画个", "画一幅", "make a picture", "画一个",
    "帮我画", "请画", "帮我生成", "请生成", "帮我做", "请做"
  ];

  let prompt = query.trim();

  for (const prefix of prefixes) {
    const lowerPrefix = prefix.toLowerCase();
    const lowerQuery = prompt.toLowerCase();

    if (lowerQuery.startsWith(lowerPrefix)) {
      prompt = prompt.slice(prefix.length).trim();
      prompt = prompt.replace(/^[,，.。!！?？:：;；]+/, "").trim();
    }
  }

  return prompt || query;
};

/**
 * 调用图片生成 API
 */
export const generateImage = async (
  prompt: string
): Promise<Attachment> => {
  console.log("Generating image with prompt:", prompt);

  const apiKey = localStorage.getItem("OPENAI_API_KEY");
  const baseUrl = localStorage.getItem("OPENAI_BASE_URL") || "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("未设置 OpenAI API Key，请在设置中配置");
  }

  // 根据 API.302.ai 文档构建正确的请求体
  const requestBody = {
    prompt: prompt,
    model: "gpt-image-2",
    size: "1024x1024",
    n: 1,
    background: "auto",
    moderation: "auto",
    output_format: "png"
  };

  console.log("Request body:", requestBody);
  console.log("Base URL:", baseUrl);
  console.log("API Key length:", apiKey.length);

  const url = `${baseUrl}/images/generations`;
  console.log("Request URL:", url);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      const responseText = await response.text();
      console.error("Response text:", responseText);

      let errorData: any = {};
      try {
        errorData = JSON.parse(responseText);
      } catch (e) {
        console.log("Failed to parse error response as JSON");
      }

      console.error("API Error:", errorData);

      const errorMessage =
        errorData.error?.message ||
        errorData.message ||
        errorData.message_cn ||
        `图片生成失败: ${response.status}`;

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("API Response:", data);

    let imageUrl: string;

    if (data.data && data.data[0]) {
      if (data.data[0].b64_json) {
        imageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
      } else if (data.data[0].url) {
        imageUrl = data.data[0].url;
      } else {
        throw new Error("不支持的图片响应格式");
      }
    } else {
      throw new Error("API 返回格式异常");
    }

    return {
      id: uuidv4(),
      type: "image",
      url: imageUrl,
      name: `generated-image-${Date.now()}.png`
    };
  } catch (error) {
    console.error("Full error:", error);
    throw error;
  }
};
