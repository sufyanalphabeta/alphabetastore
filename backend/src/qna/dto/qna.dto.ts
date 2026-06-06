import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreateQuestionDto {
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  question!: string;
}

export class AnswerQuestionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  answer!: string;
}
