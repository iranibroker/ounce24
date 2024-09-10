import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  _id: any;
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true, default: 0 })
  defaultScore: number;

  @Prop({ required: false, unique: false })
  telegramUsername?: string;

  @Prop({ index: true, unique: true })
  telegramId: number;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({ required: false })
  resetAt: Date;

  @Prop({ required: false })
  iban: string;

  score?: number;
  tag: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('tag').get(function () {
  let tag = '#استاد_';
  if (this.title) {
    const cleanedTitle = this.title.replace(/[&@#.]/g, '').replace(/[ -]/g, '_');
    tag += cleanedTitle;
  }
  return tag;
});
