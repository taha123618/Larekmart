import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service.js";
import {
  type AttachDocumentInput,
  AttachDocumentSchema,
  DocumentVerificationStatusEnum,
  VendorStatusEnum,
} from "@repo/types";

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async attachDocument(vendorId: string, userId: string, rawInput: AttachDocumentInput) {
    const input = AttachDocumentSchema.parse(rawInput);

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with id ${vendorId} not found`);
    }

    if (vendor.status === VendorStatusEnum.TERMINATED) {
      throw new BadRequestException("Cannot attach documents to a terminated vendor organization");
    }

    const document = await this.prisma.vendorDocument.create({
      data: {
        vendorId,
        documentType: input.documentType,
        mediaFileId: input.mediaFileId,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        uploadedByUserId: userId,
        verificationStatus: DocumentVerificationStatusEnum.PENDING,
      },
    });

    return document;
  }

  async getVendorDocuments(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!vendor) {
      throw new NotFoundException(`Vendor with id ${vendorId} not found`);
    }

    return this.prisma.vendorDocument.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteDocument(vendorId: string, documentId: string) {
    const doc = await this.prisma.vendorDocument.findFirst({
      where: { id: documentId, vendorId },
    });

    if (!doc) {
      throw new NotFoundException(`Document with id ${documentId} not found`);
    }

    await this.prisma.vendorDocument.delete({
      where: { id: documentId },
    });

    return { success: true, message: "Document removed successfully" };
  }
}
