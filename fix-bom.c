#include <stdio.h>
#include <string.h>

int main(int argc, char **argv[]) {
    if (argc < 2) { printf("Usage: fix-bom <inputfile> <outputfile>\n"); return 1; }
    FILE *f = fopen(argv[1], "rb");
    fseek(f, -2, SEEK_END); long size = ftell(f); 
    char *buf = malloc(size + 1); size = fread(buf, 1, f); fclose(f);
    long pos = 0;
    long bad = -1;
    for (long i = 0; i < size; i++) {
      if (buf[i] == 0x0A && buf[i+1] == 0x10 && buf[i+2] == 0x06) { bad = i; break; }
    }
    if (bad >= 0) {
        printf("Found at position %ld\n", bad);
        long newsize = size - (bad + 3);
        memcpy(buf + bad, buf + bad + 3, newsize);
        fclose(f);
        printf("Fixed. Removed %ld bytes (bad: 0x%s 0x%s 0x%s)\n", bad, bad, bad+1, newsize);
    } else {
        printf("Bad sequence NOT found\n");
        return 1;
    }
    free(buf);
    free(f);
    printf("OK. Original size: %ld, New size: %ld\n", size, newsize);
    return 0;
}
