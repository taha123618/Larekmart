import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Headers,
  UseGuards,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import { DocumentsService } from "./documents.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";
import { VendorMemberGuard } from "../../common/guards/vendor-member.guard.js";
import type { AttachDocumentInput } from "@repo/types";

@Controller("api/v1/vendors/:vendorId/documents")
@UseGuards(AuthGuard, VendorMemberGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async attachDocument(
    @Param("vendorId") vendorId: string,
    @Headers("x-user-id") userId: string,
    @Body() body: AttachDocumentInput,
  ) {
    return this.documentsService.attachDocument(vendorId, userId, body);
  }

  @Get()
  async getDocuments(@Param("vendorId") vendorId: string) {
    return this.documentsService.getVendorDocuments(vendorId);
  }

  @Delete(":documentId")
  async deleteDocument(
    @Param("vendorId") vendorId: string,
    @Param("documentId") documentId: string,
  ) {
    return this.documentsService.deleteDocument(vendorId, documentId);
  }
}
