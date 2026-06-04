import { IsString, Length, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(20, 256)
  token!: string;

  @IsString()
  @Length(8, 72)
  @MaxLength(72)
  newPassword!: string;
}
