import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({unique: true})
  telegramUsername: string;

  @Prop({ index: true, unique: true })
  telegramId: number;

  @Prop({ required: true, unique: true })
  phone: string;

}

export const UserSchema = SchemaFactory.createForClass(User);
