import { Controller, Get, Module } from "@nestjs/common";

@Controller()
class AppController {
  @Get()
  hello(): string {
    return "example-be";
  }
}

@Module({ controllers: [AppController] })
export class AppModule {}
