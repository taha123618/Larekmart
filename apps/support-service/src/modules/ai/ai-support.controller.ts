import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import {
  AiSupportService,
  type AiSupportMetrics,
} from "./ai-support.service.js";
import { AiSupportMessageSchema, type AiSupportResponse } from "@repo/types";

@Controller("api/v1/support/ai")
export class AiSupportController {
  constructor(
    @Inject(AiSupportService)
    private readonly aiSupportService: AiSupportService,
  ) {}

  @Get("metrics")
  @HttpCode(HttpStatus.OK)
  async getMetrics(): Promise<{ success: boolean; data: AiSupportMetrics }> {
    return {
      success: true,
      data: this.aiSupportService.getMetrics(),
    };
  }

  @Post("chat")
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() body: unknown,
  ): Promise<{ success: boolean; data: AiSupportResponse }> {
    const validated = AiSupportMessageSchema.parse(body);
    const result = await this.aiSupportService.answerQuestion(validated);
    return {
      success: true,
      data: result,
    };
  }
}
