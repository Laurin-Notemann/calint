export default async function ErrorPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const errorMsg = searchParams["error-msg"];

  return (
    <div className="flex flex-col gap-10 mt-20">
      <h1 className="text-2xl self-center">An Error has occured: </h1>
      <p className="text-lg self-center text-red-600">
        {errorMsg ||
          "Some unkown issue with OAuth. Please contact: laurin.notemann@gmail.com"}
      </p>
    </div>
  );
}
