function FindFileData_Recursive( data, baseDirectory, template, recursive )
{
   let find = new FileFind;
   if ( find.begin( baseDirectory + template ) )
      do
         if ( find.isFile )
            data.push( { path:         baseDirectory+find.name,
                         size:         find.size,
                         created:      find.created,
                         lastModified: find.lastModified } );
      while ( find.next() );

   if ( recursive )
   {
      let directories = [];
      if ( find.begin( baseDirectory + "*" ) )
         do
            if ( find.isDirectory )
               if ( find.name != "." )
                  if ( find.name != ".." )
                     directories.push( baseDirectory + find.name + '/' );
         while ( find.next() );

      for ( let i = 0; i < directories.length; ++i )
         FindFileData_Recursive( data, directories[i], template, recursive );
   }
}

function FindFileData( baseDirectory, templates, recursive )
{
   if ( !baseDirectory.endsWith( '/' ) )
      baseDirectory += '/';

   if ( templates === undefined )
      templates = ['*'];
   else if ( !(templates instanceof Array) )
      templates = [templates];
      
   if ( recursive === undefined )
      recursive = true;
      
   let data = [];
   for ( let i = 0; i < templates.length; ++i )
      FindFileData_Recursive( data, baseDirectory, templates[i], recursive );
   return data;
}