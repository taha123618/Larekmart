import { Controller, Get, UseGuards, Inject } from "@nestjs/common";
import { CategoriesService } from "./categories.service.js";
import { AuthGuard } from "../../common/guards/auth.guard.js";

@Controller("api/v1/support/categories")
export class CategoriesController {
  constructor(
    @Inject(CategoriesService)
    private readonly categoriesService: CategoriesService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  async getCategories() {
    const categories = await this.categoriesService.listCategories();
    return {
      success: true,
      data: categories,
    };
  }
}
