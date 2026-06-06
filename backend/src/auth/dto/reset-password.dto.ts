import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(20, 256)
  token!: string;

  @IsString()
  @Length(8, 72)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number.',
  })
  newPassword!: string;
}
