import { Controller, Get, Inject } from "@nestjs/common";
import { PlatformService } from "./platform.service";

@Controller("platform")
export class PlatformController {
  constructor(@Inject(PlatformService) private readonly platformService: PlatformService) {
    this.listModules = this.listModules.bind(this);
  }

  @Get("modules")
  listModules() {
    return this.platformService.listModules();
  }
}
