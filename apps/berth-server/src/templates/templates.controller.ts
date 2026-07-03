import { Controller, Get } from '@nestjs/common';
import { TEMPLATES, type TemplateDto } from './templates.constants';

@Controller('templates')
export class TemplatesController {
  @Get()
  list(): TemplateDto[] {
    return TEMPLATES;
  }
}
