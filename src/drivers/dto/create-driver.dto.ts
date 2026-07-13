import { IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateDriverDto {
  @IsString()
  id!: string;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;
}
