import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
  constructor(private readonly apiKey: string, private readonly modelName: string) {}

  async analyze(financialContext: string, question: string, timeoutMs = 15_000): Promise<string> {
    if (!this.apiKey) throw new Error("Gemini is not configured");
    const prompt = `${financialContext}\n\nQuestion: ${question}`;
    if (prompt.length > 12_000) throw new Error("Prompt exceeds the allowed size");
    const model = new GoogleGenerativeAI(this.apiKey).getGenerativeModel({model: this.modelName});
    const operation = model.generateContent(prompt);
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Gemini request timed out")), timeoutMs));
    const result = await Promise.race([operation, timeout]);
    return result.response.text();
  }
}

