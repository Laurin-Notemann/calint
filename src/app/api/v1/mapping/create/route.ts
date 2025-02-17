import { MappingSelections } from "@/components/pipedrive-setup";
import { querier } from "@/db/queries";
import { NewTypeMappingType, TypeMappingType } from "@/db/schema";
import { NextRequest, NextResponse } from "next/server";

type MappingsResponse = {
  success: boolean;
  data: TypeMappingType[];
};

export type MappingsRequessBody = {
  mappings: MappingSelections;
  eventTypeId: string;
};

export async function POST(request: NextRequest) {
  try {
    const body: MappingsRequessBody = await request.json();

    //const test: NewTypeMappingType;
    //const [upsertErr, item] = await querier.updateOrCreateTypeMapping();
  } catch (error) {
    return NextResponse.json({ success: false, data: [] });
  }
}
